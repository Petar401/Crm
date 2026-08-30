"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveApolloApiKey } from "@/features/apollo/settings-queries";
import { apolloSearchSchema } from "@/features/apollo/settings-schemas";
import { scoreApolloPerson } from "@/features/apollo/score";
import {
  searchPeople,
  enrichOrganization,
  ApolloApiError,
  type ApolloPerson,
} from "@/features/apollo/client";

const PER_PAGE = 25;

export interface ApolloResultPreview {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  score: number;
  matchReason: string | null;
  alreadyInCrm: boolean;
}

export interface SearchResult {
  error?: string;
  results?: ApolloResultPreview[];
  totalEntries?: number;
  page?: number;
}

function toPreview(
  person: ApolloPerson,
  score: number,
  matchReason: string,
  alreadyInCrm: boolean
): ApolloResultPreview {
  return {
    id: person.id,
    name:
      person.name ??
      [person.first_name, person.last_name].filter(Boolean).join(" ") ??
      "Unknown",
    title: person.title,
    email: person.email,
    emailStatus: person.email_status,
    phone: person.phone_numbers?.[0]?.raw_number ?? null,
    companyName: person.organization?.name ?? null,
    website: person.organization?.website_url ?? null,
    industry: person.organization?.industry ?? null,
    city: person.organization?.city ?? person.city,
    country: person.organization?.country ?? person.country,
    score,
    matchReason,
    alreadyInCrm,
  };
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((t) => t.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function hostOf(website: string | null | undefined): string | null {
  if (!website) return null;
  return website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]?.toLowerCase() ?? null;
}

/**
 * Preview-only: never writes to the database, just previews Apollo results.
 * `page` lets the UI load additional pages ("Load more") on top of an
 * existing result set.
 */
export async function searchApolloPeople(
  values: unknown,
  page = 1
): Promise<SearchResult> {
  const parsed = apolloSearchSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.import");

  const apiKey = await resolveApolloApiKey(ctx.workspace.id);
  if (!apiKey) {
    return { error: "Apollo isn't configured. Add your API key in Settings first." };
  }

  const titles = splitList(parsed.data.personTitles);
  const seniorities = splitList(parsed.data.personSeniorities);
  const domains = splitList(parsed.data.organizationDomains);
  const locations = splitList(parsed.data.locations);
  const employeeRanges = splitList(parsed.data.employeeRanges);
  const excludeTitles = splitList(parsed.data.excludeTitles) ?? [];
  const excludeDomains = (splitList(parsed.data.excludeDomains) ?? []).map((d) =>
    d.toLowerCase()
  );

  try {
    const { people, totalEntries } = await searchPeople(apiKey, {
      personTitles: titles,
      personSeniorities: seniorities,
      qOrganizationName: parsed.data.organizationName || undefined,
      qOrganizationDomains: domains,
      organizationLocations: locations,
      qKeywords: parsed.data.keywords || undefined,
      organizationNumEmployeesRanges: employeeRanges,
      perPage: PER_PAGE,
      page,
    });

    const filtered = people.filter((p) => {
      if (
        excludeTitles.length &&
        excludeTitles.some((t) => p.title?.toLowerCase().includes(t.toLowerCase()))
      ) {
        return false;
      }
      const host = hostOf(p.organization?.website_url);
      if (host && excludeDomains.includes(host)) return false;
      return true;
    });

    const supabase = await createClient();
    const refs = filtered.map((p) => `apollo:${p.id}`);
    const { data: existing } = refs.length
      ? await supabase
          .from("leads")
          .select("source_ref")
          .eq("workspace_id", ctx.workspace.id)
          .in("source_ref", refs)
      : { data: [] as { source_ref: string | null }[] };
    const existingRefs = new Set((existing ?? []).map((r) => r.source_ref));

    const scoreFilters = { organizationDomains: domains, locations, personSeniorities: seniorities };
    const results = filtered.map((p) => {
      const { score, reason } = scoreApolloPerson(p, scoreFilters);
      return toPreview(p, score, reason, existingRefs.has(`apollo:${p.id}`));
    });

    return { results, totalEntries, page };
  } catch (e) {
    if (e instanceof ApolloApiError) {
      if (e.kind === "unauthorized") {
        return { error: "Apollo rejected the API key — check it in Settings." };
      }
      if (e.kind === "credits") {
        return { error: "Apollo search failed — you may be out of credits or plan limit." };
      }
      if (e.kind === "rate_limited") {
        return { error: "Apollo is rate-limiting requests — try again in a moment." };
      }
    }
    return { error: e instanceof Error ? e.message : "Apollo search failed." };
  }
}

export interface BulkResult {
  error?: string;
  count?: number;
}

/**
 * Imports selected Apollo search results as new leads. Always lands them in
 * "pending" (never auto-approved) — these are credit-metered picks the user
 * explicitly selected, so they still go through the normal review queue.
 * A unique-index conflict on source_ref (already imported) is treated as a
 * skip, not an error. For each imported lead with a known website, this also
 * calls Organization Enrichment to fill in a real company address — done
 * only for the leads actually being imported (not every preview row) to
 * keep Apollo credit usage proportional to what the user picked.
 */
export async function importApolloLeads(
  selections: ApolloResultPreview[]
): Promise<BulkResult> {
  if (selections.length === 0) return { count: 0 };

  const ctx = await requireAuthContext();
  await requirePermission("leads.import");

  const apiKey = await resolveApolloApiKey(ctx.workspace.id);
  const supabase = await createClient();
  let count = 0;

  for (const person of selections) {
    let addressLine1: string | null = null;
    let state: string | null = null;
    let postalCode: string | null = null;
    let city = person.city;
    let country = person.country;

    const domain = hostOf(person.website);
    if (apiKey && domain) {
      try {
        const org = await enrichOrganization(apiKey, domain);
        if (org) {
          addressLine1 = org.street_address ?? org.raw_address ?? null;
          state = org.state ?? null;
          postalCode = org.postal_code ?? null;
          city = org.city ?? city;
          country = org.country ?? country;
        }
      } catch {
        // Address enrichment is best-effort — a failure here shouldn't block
        // the import itself, the lead just keeps whatever it had from search.
      }
    }

    const { error } = await supabase.from("leads").insert({
      workspace_id: ctx.workspace.id,
      company_name: person.companyName ?? person.name,
      website: person.website,
      email: null,
      phone: person.phone,
      address_line_1: addressLine1,
      state,
      postal_code: postalCode,
      city,
      country,
      industry: person.industry,
      contact_name: person.name,
      contact_email: person.email,
      contact_phone: person.phone,
      job_title: person.title,
      source: "apollo",
      source_ref: `apollo:${person.id}`,
      match_score: person.score ?? null,
      match_reason: person.matchReason ?? null,
      status: "pending",
      raw: person,
      owner_user_id: ctx.userId,
      created_by: ctx.userId,
    });
    // A unique violation on (workspace_id, source_ref) means this result was
    // already imported — skip it silently rather than surfacing an error.
    if (!error) count += 1;
  }

  revalidatePath("/leads");
  return { count };
}
