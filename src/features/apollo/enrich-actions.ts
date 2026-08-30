"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveApolloApiKey } from "@/features/apollo/settings-queries";
import { enrichPerson, ApolloApiError } from "@/features/apollo/client";
import type { Lead } from "@/lib/db/types";

const MAX_BULK_ENRICH = 25;

export interface EnrichResult {
  error?: string;
  enriched?: string[];
}

function hostname(website: string | null): string | undefined {
  if (!website) return undefined;
  try {
    const withProto = website.startsWith("http") ? website : `https://${website}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Enriches a single lead via Apollo's People Enrichment ("match") endpoint,
 * filling in email/phone/job title ONLY where the lead doesn't already have
 * them. Never overwrites existing data. Costs one Apollo credit regardless of
 * whether Apollo returns anything new, so the caller should confirm first.
 */
export async function enrichLead(leadId: string): Promise<EnrichResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.import");

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Lead>();
  if (!lead) return { error: "Lead not found." };

  const apiKey = await resolveApolloApiKey(ctx.workspace.id);
  if (!apiKey) {
    return { error: "Apollo isn't configured. Add your API key in Settings first." };
  }

  const [firstName, ...rest] = (lead.contact_name ?? "").trim().split(/\s+/);

  let person;
  try {
    person = await enrichPerson(apiKey, {
      email: lead.contact_email ?? lead.email ?? undefined,
      firstName: firstName || undefined,
      lastName: rest.length ? rest.join(" ") : undefined,
      organizationName: lead.company_name,
      domain: hostname(lead.website),
    });
  } catch (e) {
    if (e instanceof ApolloApiError) {
      if (e.kind === "unauthorized") {
        return { error: "Apollo rejected the API key — check it in Settings." };
      }
      if (e.kind === "credits") {
        return { error: "Apollo enrichment failed — you may be out of credits or plan limit." };
      }
      if (e.kind === "rate_limited") {
        return { error: "Apollo is rate-limiting requests — try again in a moment." };
      }
    }
    return { error: e instanceof Error ? e.message : "Apollo enrichment failed." };
  }

  if (!person) return { enriched: [] };

  const enriched: string[] = [];
  const update: Record<string, unknown> = {
    raw: { ...(lead.raw as object | null), apollo_enrichment: person },
    enriched_at: new Date().toISOString(),
    enriched_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };

  if (!lead.contact_email && person.email) {
    update.contact_email = person.email;
    enriched.push("email");
  }
  if (!lead.email && person.email) {
    update.email = person.email;
  }
  const phone = person.phone_numbers?.[0]?.raw_number;
  if (!lead.contact_phone && phone) {
    update.contact_phone = phone;
    enriched.push("phone");
  }
  if (!lead.phone && phone) {
    update.phone = phone;
  }
  if (!lead.job_title && person.title) {
    update.job_title = person.title;
    enriched.push("job title");
  }

  const { error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { enriched };
}

export interface BulkEnrichResult {
  error?: string;
  count?: number;
}

/**
 * Sequential (not parallel) — Apollo enrichment is credit-billed per call, so
 * running one at a time keeps this easy to reason about and cheap to stop.
 * Capped server-side so a fat-fingered "select all" can't burn a huge batch
 * of credits in one click.
 */
export async function bulkEnrichLeads(leadIds: string[]): Promise<BulkEnrichResult> {
  if (leadIds.length === 0) return { count: 0 };
  if (leadIds.length > MAX_BULK_ENRICH) {
    return { error: `Enrich at most ${MAX_BULK_ENRICH} leads at a time.` };
  }

  let count = 0;
  for (const id of leadIds) {
    const result = await enrichLead(id);
    if (!result.error) count += 1;
  }
  return { count };
}
