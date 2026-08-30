import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText } from "@/features/ai/generate-text";
import { resolveAiCredentials } from "@/features/ai/settings-queries";
import { resolveApolloApiKey } from "@/features/apollo/settings-queries";
import {
  searchPeople,
  enrichPerson,
  ApolloApiError,
  type ApolloPerson,
} from "@/features/apollo/client";
import {
  normalizeHost,
  markCampaignRun,
} from "@/features/leads/campaign-run-utils";
import type { LeadCampaign } from "@/lib/db/types";

export interface RunResult {
  count: number;
  scanned: number;
  error?: string;
}

/**
 * AI-scores an Apollo result against the campaign's business description.
 * Unlike the OSM scorer, there's no website to scrape — Apollo already
 * returns real title/company/industry — so the base score starts higher
 * (Apollo leads are inherently "complete": a real, contactable person).
 */
async function scoreApolloLead(
  person: ApolloPerson,
  campaign: LeadCampaign
): Promise<{ score: number; reason: string | null }> {
  const BASE_SCORE = 60;
  const credentials = await resolveAiCredentials(campaign.workspace_id);
  if (!credentials) return { score: BASE_SCORE, reason: null };

  const prompt = [
    `Our business: ${campaign.business_description}`,
    "",
    "Candidate lead (from Apollo.io):",
    JSON.stringify({
      name: person.name,
      title: person.title,
      company: person.organization?.name,
      industry: person.organization?.industry,
      city: person.organization?.city ?? person.city,
      country: person.organization?.country ?? person.country,
    }),
    "",
    "Reply with ONLY a JSON object, no prose, in this exact shape:",
    `{"score": <0-100 how well this is a fit as a prospect for OUR business>,`,
    `"reason": "<one short sentence>"}`,
  ].join("\n");

  try {
    const raw = await generateText(
      prompt,
      "You are a B2B sales research assistant. Output strict JSON only. Never invent facts.",
      credentials
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { score: BASE_SCORE, reason: null };
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const aiScore = Number(parsed.score);
    const reason = typeof parsed.reason === "string" ? parsed.reason : null;
    if (!Number.isFinite(aiScore)) return { score: BASE_SCORE, reason };
    const clamped = Math.max(0, Math.min(100, aiScore));
    return { score: Math.round(clamped * 0.7 + BASE_SCORE * 0.3), reason };
  } catch {
    return { score: BASE_SCORE, reason: null };
  }
}

/**
 * Runs an Apollo-sourced campaign: bulk-search Apollo's People database by
 * job title + location, dedupe against existing leads/companies, enrich each
 * fresh result for a verified email (costing a search credit + an enrichment
 * credit per lead), score it, and queue it for review. Results always land
 * in "pending" — never auto-created — regardless of the campaign's
 * auto_create toggle (that's OSM-only; enforced by the caller too, see
 * src/features/leads/actions.ts:toCampaignRow).
 */
export async function runApolloCampaign(
  supabase: SupabaseClient,
  campaign: LeadCampaign,
  actorUserId: string | null
): Promise<RunResult> {
  const apiKey = await resolveApolloApiKey(campaign.workspace_id);
  if (!apiKey) {
    await markCampaignRun(supabase, campaign.id, "error", 0);
    return {
      count: 0,
      scanned: 0,
      error: "Apollo isn't configured for this workspace.",
    };
  }

  const titles = campaign.target_categories.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0) {
    await markCampaignRun(supabase, campaign.id, "error", 0);
    return { count: 0, scanned: 0, error: "Add at least one job title." };
  }

  const location = campaign.country
    ? `${campaign.location}, ${campaign.country}`
    : campaign.location;

  let people: ApolloPerson[];
  try {
    const result = await searchPeople(apiKey, {
      personTitles: titles,
      organizationLocations: location ? [location] : undefined,
      perPage: Math.min(campaign.max_results, 100),
    });
    people = result.people;
  } catch (e) {
    await markCampaignRun(supabase, campaign.id, "error", 0);
    const error = e instanceof ApolloApiError ? e.message : "Apollo search failed.";
    return { count: 0, scanned: 0, error };
  }

  // Dedupe against already-imported Apollo refs and existing companies, same
  // approach as the OSM campaign runner.
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
    (existingCompanies ?? []).map((c: { name: string }) => c.name.toLowerCase())
  );
  const companyHosts = new Set(
    (existingCompanies ?? [])
      .map((c: { website: string | null }) => normalizeHost(c.website))
      .filter(Boolean)
  );

  const fresh = people
    .filter((p) => {
      if (seenRefs.has(`apollo:${p.id}`)) return false;
      const name = p.organization?.name ?? p.name;
      if (name && companyNames.has(name.toLowerCase())) return false;
      const host = normalizeHost(p.organization?.website_url ?? null);
      if (host && companyHosts.has(host)) return false;
      return true;
    })
    .slice(0, campaign.max_results);

  let count = 0;
  let stoppedEarly = false;

  for (const person of fresh) {
    let enriched: ApolloPerson | null;
    try {
      enriched = await enrichPerson(apiKey, {
        email: person.email ?? undefined,
        firstName: person.first_name ?? undefined,
        lastName: person.last_name ?? undefined,
        organizationName: person.organization?.name ?? undefined,
        domain: normalizeHost(person.organization?.website_url ?? null) ?? undefined,
      });
    } catch (e) {
      if (e instanceof ApolloApiError && e.kind === "unauthorized") {
        await markCampaignRun(supabase, campaign.id, "error", count);
        return { count, scanned: people.length, error: "Apollo rejected the API key." };
      }
      // Out of credits or any other enrichment failure: stop importing
      // further leads this run, keep whatever already succeeded.
      stoppedEarly = true;
      break;
    }

    const contact = enriched ?? person;
    const { score, reason } = await scoreApolloLead(contact, campaign);
    if (score < (campaign.min_score ?? 0)) continue;

    const { error } = await supabase.from("leads").insert({
      workspace_id: campaign.workspace_id,
      campaign_id: campaign.id,
      company_name: contact.organization?.name ?? contact.name ?? "Unknown",
      website: contact.organization?.website_url ?? null,
      industry: contact.organization?.industry ?? null,
      city: contact.organization?.city ?? contact.city,
      country: contact.organization?.country ?? contact.country,
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone_numbers?.[0]?.raw_number ?? null,
      job_title: contact.title,
      source: "apollo",
      source_ref: `apollo:${person.id}`,
      match_score: score,
      match_reason: reason,
      status: "pending",
      owner_user_id: actorUserId,
      created_by: actorUserId,
      raw: { search: person, enrichment: enriched },
    });
    if (!error) count += 1;
  }

  await markCampaignRun(supabase, campaign.id, stoppedEarly ? "partial" : "ok", count);
  return {
    count,
    scanned: people.length,
    error: stoppedEarly
      ? "Stopped early — Apollo credit or plan limit reached."
      : undefined,
  };
}
