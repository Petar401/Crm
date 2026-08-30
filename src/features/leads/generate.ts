import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText } from "@/features/ai/generate-text";
import { resolveAiCredentials } from "@/features/ai/settings-queries";
import type { LeadCampaign } from "@/lib/db/types";
import { safeFetchText } from "@/lib/utils/safe-fetch";
import { searchBusinesses, type OverpassBusiness } from "./overpass";
import { normalizeHost, markCampaignRun } from "./campaign-run-utils";
import { runApolloCampaign } from "@/features/apollo/campaign-run";

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

/**
 * Best-effort fetch of a business homepage, returned as a short text snippet.
 * Runs through `safeFetchText` so an attacker-controlled OSM website field
 * (or any other user-supplied URL that flows into a lead campaign) cannot be
 * used to reach internal metadata endpoints, private subnets, or loopback
 * from the server runtime.
 */
async function fetchSiteText(website: string | null): Promise<string | null> {
  if (!website) return null;
  const url = website.startsWith("http") ? website : `https://${website}`;
  const result = await safeFetchText(url, {
    timeoutMs: 6000,
    maxBytes: 1_000_000,
    userAgent: "CRM-LeadFinder/1.0",
  });
  if (!result || !result.text) return null;
  return result.text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
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
  const credentials = await resolveAiCredentials(campaign.workspace_id);
  if (!credentials) {
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
      "You are a B2B sales research assistant. Output strict JSON only. Never invent facts.",
      credentials
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
 * Deterministic 0–100 "point" score from how contactable / complete a lead is.
 * Guarantees every lead is scored even when AI is unavailable. Signals: a
 * website, an email, a phone, a known contact person, a street address, and a
 * category all add points.
 */
function computeBaseScore(
  business: OverpassBusiness,
  enriched: Enrichment
): number {
  let score = 20; // baseline for being a named, matched business
  if (business.website) score += 25;
  if (enriched.contactEmail ?? business.email) score += 20;
  if (business.phone) score += 15;
  if (enriched.contactName) score += 10;
  if (business.street) score += 5;
  if (business.category) score += 5;
  return Math.max(0, Math.min(100, score));
}

/**
 * Final score: when the AI returned a fit score, blend it with the
 * contactability base so reachable leads still rank; otherwise fall back to the
 * base score alone.
 */
function finalScore(aiScore: number | null, baseScore: number): number {
  if (aiScore == null) return baseScore;
  return Math.round(aiScore * 0.7 + baseScore * 0.3);
}

/**
 * Run a single campaign. Dispatches on `campaign.source`: OpenStreetMap
 * (free, the original implementation below) or Apollo.io (paid, bulk B2B
 * search + enrichment — see src/features/apollo/campaign-run.ts). Accepts the
 * Supabase client so it works from both an RLS-aware server action and the
 * service-role cron route.
 */
export async function runCampaign(
  supabase: SupabaseClient,
  campaign: LeadCampaign,
  actorUserId: string | null
): Promise<RunResult> {
  if (campaign.source === "apollo") {
    return runApolloCampaign(supabase, campaign, actorUserId);
  }
  return runOsmCampaign(supabase, campaign, actorUserId);
}

/**
 * Run a single OpenStreetMap campaign: discover businesses, dedupe, AI-score/
 * enrich, then either queue leads for review or auto-create Company
 * (+ Contact) records.
 */
async function runOsmCampaign(
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
    await markCampaignRun(supabase, campaign.id, "error", 0);
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

    const baseScore = computeBaseScore(business, enriched);
    const score = finalScore(enriched.score, baseScore);
    // Skip leads below the campaign's minimum score threshold.
    if (score < (campaign.min_score ?? 0)) continue;
    const reason =
      enriched.reason ??
      (enriched.score == null
        ? "Scored on available contact details (AI scoring disabled)."
        : null);

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
      match_score: score,
      match_reason: reason,
      owner_user_id: actorUserId,
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

  await markCampaignRun(supabase, campaign.id, "ok", count);
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
