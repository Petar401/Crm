import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText } from "@/features/ai/generate-text";
import { resolveAiCredentials } from "@/features/ai/settings-queries";
import { resolveApolloApiKey } from "@/features/apollo/settings-queries";
import { scoreApolloPerson } from "@/features/apollo/score";
import {
  searchPeople,
  enrichPerson,
  enrichOrganization,
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
  skipped?: number;
  error?: string;
}

/**
 * AI-scores an Apollo result against the campaign's business description,
 * layered on top of the same completeness heuristic used by the ad-hoc
 * search/import path (scoreApolloPerson) so both paths produce comparable
 * scores rather than diverging baselines.
 */
async function scoreApolloLead(
  person: ApolloPerson,
  campaign: LeadCampaign
): Promise<{ score: number; reason: string | null }> {
  const { score: baseScore, reason: baseReason } = scoreApolloPerson(person, {
    locations: campaign.location ? [campaign.location] : undefined,
  });
  const credentials = await resolveAiCredentials(campaign.workspace_id);
  if (!credentials) return { score: baseScore, reason: baseReason };

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
    if (!match) return { score: baseScore, reason: baseReason };
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const aiScore = Number(parsed.score);
    const reason = typeof parsed.reason === "string" ? parsed.reason : baseReason;
    if (!Number.isFinite(aiScore)) return { score: baseScore, reason };
    const clamped = Math.max(0, Math.min(100, aiScore));
    return { score: Math.round(clamped * 0.7 + baseScore * 0.3), reason };
  } catch {
    return { score: baseScore, reason: baseReason };
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

  // Enrichment (Apollo) + AI scoring are both per-lead network calls; running
  // them one at a time made a full campaign (up to 100 leads) slow enough to
  // risk exceeding the route's execution budget. Process in small concurrent
  // batches instead — inserts stay sequential per batch so a failure partway
  // through still stops the run at a well-defined point.
  const BATCH_SIZE = 5;
  const CONSECUTIVE_FAILURE_LIMIT = 3;
  let count = 0;
  let skipped = 0;
  let stoppedEarly = false;
  let unauthorizedError: string | null = null;
  let consecutiveFailures = 0;

  batches: for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (person) => {
        try {
          const enriched = await enrichPerson(apiKey, {
            email: person.email ?? undefined,
            firstName: person.first_name ?? undefined,
            lastName: person.last_name ?? undefined,
            organizationName: person.organization?.name ?? undefined,
            domain:
              normalizeHost(person.organization?.website_url ?? null) ??
              undefined,
          });
          const contact = enriched ?? person;
          const { score, reason } = await scoreApolloLead(contact, campaign);
          return { person, enriched, contact, score, reason, error: null as ApolloApiError | Error | null };
        } catch (e) {
          return {
            person,
            enriched: null,
            contact: null,
            score: null,
            reason: null,
            error: e instanceof Error ? e : new Error("Enrichment failed."),
          };
        }
      })
    );

    for (const result of batchResults) {
      if (result.error) {
        if (result.error instanceof ApolloApiError && result.error.kind === "unauthorized") {
          unauthorizedError = "Apollo rejected the API key.";
          break;
        }
        // A single failed lead shouldn't truncate the rest of the run — skip
        // it and keep going. Only sustained failures (credits exhausted,
        // persistent rate limiting) stop the run early.
        skipped += 1;
        consecutiveFailures += 1;
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
          stoppedEarly = true;
        }
        continue;
      }

      consecutiveFailures = 0;
      const { person, enriched, contact, score, reason } = result;
      if (score! < (campaign.min_score ?? 0)) continue;

      let addressLine1: string | null = null;
      let state: string | null = null;
      let postalCode: string | null = null;
      const domain = normalizeHost(contact!.organization?.website_url ?? null);
      if (domain) {
        try {
          const org = await enrichOrganization(apiKey, domain);
          if (org) {
            addressLine1 = org.street_address ?? org.raw_address ?? null;
            state = org.state ?? null;
            postalCode = org.postal_code ?? null;
          }
        } catch {
          // Address enrichment is best-effort — don't block the insert.
        }
      }

      const { error } = await supabase.from("leads").insert({
        workspace_id: campaign.workspace_id,
        campaign_id: campaign.id,
        company_name: contact!.organization?.name ?? contact!.name ?? "Unknown",
        website: contact!.organization?.website_url ?? null,
        address_line_1: addressLine1,
        state,
        postal_code: postalCode,
        industry: contact!.organization?.industry ?? null,
        city: contact!.organization?.city ?? contact!.city,
        country: contact!.organization?.country ?? contact!.country,
        contact_name: contact!.name,
        contact_email: contact!.email,
        contact_phone: contact!.phone_numbers?.[0]?.raw_number ?? null,
        job_title: contact!.title,
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

    if (unauthorizedError) {
      await markCampaignRun(supabase, campaign.id, "error", count);
      return { count, scanned: people.length, skipped, error: unauthorizedError };
    }
    if (stoppedEarly) break batches;
  }

  await markCampaignRun(supabase, campaign.id, stoppedEarly ? "partial" : "ok", count);
  return {
    count,
    scanned: people.length,
    skipped,
    error: stoppedEarly
      ? "Stopped early — repeated Apollo credit or rate-limit failures."
      : skipped > 0
        ? `${skipped} lead${skipped === 1 ? "" : "s"} skipped due to transient Apollo errors.`
        : undefined,
  };
}
