"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveApolloApiKey } from "@/features/apollo/settings-queries";
import { apolloSearchSchema } from "@/features/apollo/settings-schemas";
import {
  searchPeople,
  ApolloApiError,
  type ApolloPerson,
} from "@/features/apollo/client";

export interface ApolloResultPreview {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
}

export interface SearchResult {
  error?: string;
  results?: ApolloResultPreview[];
}

function toPreview(person: ApolloPerson): ApolloResultPreview {
  return {
    id: person.id,
    name:
      person.name ??
      [person.first_name, person.last_name].filter(Boolean).join(" ") ??
      "Unknown",
    title: person.title,
    email: person.email,
    phone: person.phone_numbers?.[0]?.raw_number ?? null,
    companyName: person.organization?.name ?? null,
    website: person.organization?.website_url ?? null,
    industry: person.organization?.industry ?? null,
    city: person.organization?.city ?? person.city,
    country: person.organization?.country ?? person.country,
  };
}

/** Preview-only: never writes to the database, just previews Apollo results. */
export async function searchApolloPeople(values: unknown): Promise<SearchResult> {
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

  const titles = parsed.data.personTitles
    ? parsed.data.personTitles.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;
  const locations = parsed.data.location ? [parsed.data.location] : undefined;
  const domains = parsed.data.organizationDomain
    ? [parsed.data.organizationDomain]
    : undefined;

  try {
    const { people } = await searchPeople(apiKey, {
      personTitles: titles,
      qOrganizationName: parsed.data.organizationName || undefined,
      qOrganizationDomains: domains,
      organizationLocations: locations,
      perPage: 25,
    });
    return { results: people.map(toPreview) };
  } catch (e) {
    if (e instanceof ApolloApiError) {
      if (e.kind === "unauthorized") {
        return { error: "Apollo rejected the API key — check it in Settings." };
      }
      if (e.kind === "credits") {
        return { error: "Apollo search failed — you may be out of credits or plan limit." };
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
 * skip, not an error.
 */
export async function importApolloLeads(
  selections: ApolloResultPreview[]
): Promise<BulkResult> {
  if (selections.length === 0) return { count: 0 };

  const ctx = await requireAuthContext();
  await requirePermission("leads.import");

  const supabase = await createClient();
  let count = 0;

  for (const person of selections) {
    const { error } = await supabase.from("leads").insert({
      workspace_id: ctx.workspace.id,
      company_name: person.companyName ?? person.name,
      website: person.website,
      email: null,
      phone: person.phone,
      city: person.city,
      country: person.country,
      industry: person.industry,
      contact_name: person.name,
      contact_email: person.email,
      contact_phone: person.phone,
      job_title: person.title,
      source: "apollo",
      source_ref: `apollo:${person.id}`,
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
