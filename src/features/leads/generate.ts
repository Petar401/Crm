import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText, isAiConfigured } from "@/features/ai/gemini";
import type { LeadCampaign } from "@/lib/db/types";
import { searchBusinesses, type OverpassBusiness } from "./overpass";

export interface RunResult {
  count: number;
  scanned: number;
  error?: string;
}

interface Enrichment {
  score: number | null;
  reason: string | null;
  contactName: string | null;
  contactEmail: string | null;
  jobTitle: string | null;
}

/** Normalise a website to a bare hostname for dedupe comparisons. */
function normalizeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").toLowerCase();
  }
}

/** Best-effort fetch of a business homepage, returned as a short text snippet. */
async function fetchSiteText(website: string | null): Promise<string | null> {
  if (!website) return null;
  const url = website.startsWith("http") ? website : `https://${website}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CRM-LeadFinder/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
  } catch {
    return null;
  }
}

/**
 * Use the AI to score how well a business fits the campaign and, best-effort,
 * extract a real contact from the website snippet. Never fabricates names: if
 * the model can't find a contact, the fields stay null.
 */
async function scoreAndEnrich(
  business: OverpassBusiness,
  campaign: LeadCampaign,
  siteText: string | null
): Promise<Enrichment> {
  if (!isAiConfigured()) {
    return {
      score: null,
      reason: null,
      contactName: null,
      contactEmail: null,
      jobTitle: null,
    };
  }

  const prompt = [
    `Our business: ${campaign.business_description}`,
    "",
    `Candidate lead (from OpenStreetMap):`,
    JSON.stringify({
      name: business.name,
      category: business.category,
      website: business.website,
      city: business.city,
      country: business.country,
    }),
    siteText ? `\nWebsite content (excerpt):\n${siteText}` : "",
    "",
    "Reply with ONLY a JSON object, no prose, in this exact shape:",
    `{"score": <0-100 how well this is a fit as a prospect for OUR business>,`,
    `"reason": "<one short sentence>",`,
    `"contact_name": <a real named person from the website or null>,`,
    `"contact_email": <a real email from the website or null>,`,
    `"job_title": <their role or null>}`,
    "Only include a contact_name if you found a real person — never invent one.",
  ].join("\n");

  try {
    const raw = await generateText(
      prompt,
      "You are a B2B sales research assistant. Output strict JSON only. Never invent facts."
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return emptyEnrichment();
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const score = Number(parsed.score);
    return {
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
      contactName:
        typeof parsed.contact_name === "string" ? parsed.contact_name : null,
      contactEmail:
        typeof parsed.contact_email === "string" ? parsed.contact_email : null,
      jobTitle: typeof parsed.job_title === "string" ? parsed.job_title : null,
    };
  } catch {
    return emptyEnrichment();
  }
}

function emptyEnrichment(): Enrichment {
  return {
    score: null,
    reason: null,
    contactName: null,
    contactEmail: null,
    jobTitle: null,
  };
}

/**
 * Run a single campaign: discover businesses, dedupe, AI-score/enrich, then
 * either queue leads for review or auto-create Company (+ Contact) records.
 * Accepts the Supabase client so it works from both an RLS-aware server action
 * and the service-role cron route.
 */
export async function runCampaign(
  supabase: SupabaseClient,
  campaign: LeadCampaign,
  actorUserId: string | null
): Promise<RunResult> {
  let businesses: OverpassBusiness[];
  try {
    businesses = await searchBusinesses({
      categories: campaign.target_categories,
      location: campaign.location ?? "",
      country: campaign.country,
      limit: campaign.max_results,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Lead source failed.";
    await markRun(supabase, campaign.id, "error", 0);
    return { count: 0, scanned: 0, error };
  }

  // Dedupe against already-imported OSM refs and existing companies.
  const [{ data: existingLeads }, { data: existingCompanies }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("source_ref")
        .eq("workspace_id", campaign.workspace_id),
      supabase
        .from("companies")
        .select("name, website")
        .eq("workspace_id", campaign.workspace_id),
    ]);

  const seenRefs = new Set(
    (existingLeads ?? []).map((l: { source_ref: string | null }) => l.source_ref)
  );
  const companyNames = new Set(
    (existingCompanies ?? []).map((c: { name: string }) =>
      c.name.toLowerCase()
    )
  );
  const companyHosts = new Set(
    (existingCompanies ?? [])
      .map((c: { website: string | null }) => normalizeHost(c.website))
      .filter(Boolean)
  );

  const fresh = businesses.filter(
    (b) =>
      !seenRefs.has(b.osmId) &&
      !companyNames.has(b.name.toLowerCase()) &&
      !(normalizeHost(b.website) && companyHosts.has(normalizeHost(b.website)))
  );

  let count = 0;
  for (const business of fresh) {
    const siteText = await fetchSiteText(business.website);
    const enriched = await scoreAndEnrich(business, campaign, siteText);

    const contactEmail = enriched.contactEmail ?? business.email;
    const base = {
      workspace_id: campaign.workspace_id,
      campaign_id: campaign.id,
      company_name: business.name,
      website: business.website,
      phone: business.phone,
      email: business.email,
      address_line_1: business.street,
      city: business.city,
      country: business.country ?? campaign.country ?? null,
      industry: business.category,
      contact_name: enriched.contactName,
      contact_email: contactEmail,
      contact_phone: business.phone,
      job_title: enriched.jobTitle,
      source: "openstreetmap",
      source_ref: business.osmId,
      match_score: enriched.score,
      match_reason: enriched.reason,
      created_by: actorUserId,
      raw: business as unknown as Record<string, unknown>,
    };

    if (campaign.auto_create) {
      const ids = await createCompanyAndContact(
        supabase,
        campaign,
        business,
        enriched,
        contactEmail,
        actorUserId
      );
      const { error } = await supabase.from("leads").insert({
        ...base,
        status: "converted",
        converted_company_id: ids.companyId,
        converted_contact_id: ids.contactId,
        reviewed_by: actorUserId,
        reviewed_at: new Date().toISOString(),
      });
      if (!error) count += 1;
    } else {
      const { error } = await supabase
        .from("leads")
        .insert({ ...base, status: "pending" });
      if (!error) count += 1;
    }
  }

  await markRun(supabase, campaign.id, "ok", count);
  return { count, scanned: businesses.length };
}

async function createCompanyAndContact(
  supabase: SupabaseClient,
  campaign: LeadCampaign,
  business: OverpassBusiness,
  enriched: Enrichment,
  contactEmail: string | null,
  actorUserId: string | null
): Promise<{ companyId: string | null; contactId: string | null }> {
  const { data: company } = await supabase
    .from("companies")
    .insert({
      workspace_id: campaign.workspace_id,
      name: business.name,
      website: business.website,
      industry: business.category,
      phone: business.phone,
      email: business.email,
      address_line_1: business.street,
      city: business.city,
      country: business.country ?? campaign.country ?? null,
      status: "lead",
      owner_user_id: actorUserId,
      created_by: actorUserId,
    })
    .select("id")
    .single<{ id: string }>();

  if (!company) return { companyId: null, contactId: null };

  // Only create a contact when we have a real person's name — never fabricate.
  let contactId: string | null = null;
  if (enriched.contactName) {
    const parts = enriched.contactName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    const { data: contact } = await supabase
      .from("contacts")
      .insert({
        workspace_id: campaign.workspace_id,
        company_id: company.id,
        first_name: firstName,
        last_name: lastName,
        email: contactEmail,
        phone: business.phone,
        job_title: enriched.jobTitle,
        is_primary: true,
        owner_user_id: actorUserId,
        created_by: actorUserId,
      })
      .select("id")
      .single<{ id: string }>();
    contactId = contact?.id ?? null;
  }

  return { companyId: company.id, contactId };
}

async function markRun(
  supabase: SupabaseClient,
  campaignId: string,
  status: string,
  count: number
): Promise<void> {
  await supabase
    .from("lead_campaigns")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_count: count,
    })
    .eq("id", campaignId);
}
