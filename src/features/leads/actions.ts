"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { can, requirePermission } from "@/lib/auth/permissions";
import { isWorkspaceMember } from "@/features/team/queries";
import {
  findForeignReference,
  foreignReferenceError,
} from "@/lib/db/ownership";
import { logActivity } from "@/features/activities/log";
import { campaignSchema, leadSchema } from "@/features/leads/schemas";
import { runCampaign } from "@/features/leads/generate";
import type { Lead, LeadCampaign } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/** Map the string-based form input to campaign table columns. */
function toCampaignRow(input: ReturnType<typeof campaignSchema.parse>) {
  const categories = input.target_categories
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const max = input.max_results ? parseInt(input.max_results, 10) : 25;
  const runHour = input.run_hour ? parseInt(input.run_hour, 10) : 9;
  const minScore = input.min_score ? parseInt(input.min_score, 10) : 0;
  return {
    name: input.name,
    source: input.source,
    business_description: input.business_description,
    target_categories: categories,
    location: input.location,
    country: input.country || null,
    frequency: input.frequency,
    // Apollo campaigns always land in the pending review queue — never
    // trust the client's auto_create value for them (the UI hides the
    // toggle, but a direct action call shouldn't be able to bypass this).
    auto_create: input.source === "apollo" ? false : input.auto_create,
    max_results: clamp(max, 1, 100),
    run_hour: clamp(runHour, 0, 23),
    min_score: clamp(minScore, 0, 100),
  };
}

export async function createCampaign(values: unknown): Promise<ActionResult> {
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.create");
  if (parsed.data.source === "apollo") await requirePermission("leads.import");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_campaigns")
    .insert({
      ...toCampaignRow(parsed.data),
      workspace_id: ctx.workspace.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return { id: data.id };
}

export async function updateCampaign(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.update");
  if (parsed.data.source === "apollo") await requirePermission("leads.import");

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_campaigns")
    .update({ ...toCampaignRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return { id };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_campaigns")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return {};
}

export interface RunActionResult {
  error?: string;
  count?: number;
}

export async function runCampaignNow(id: string): Promise<RunActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.create");

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("lead_campaigns")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<LeadCampaign>();
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.source === "apollo") await requirePermission("leads.import");

  const result = await runCampaign(supabase, campaign, ctx.userId);
  if (result.error) return { error: result.error };

  revalidatePath("/leads");
  return { count: result.count };
}

/** Map the string-based lead form input to lead table columns. */
function toLeadRow(input: ReturnType<typeof leadSchema.parse>) {
  const empty = (v: string | undefined) => (v && v !== "" ? v : null);
  return {
    company_name: input.company_name,
    website: empty(input.website),
    email: empty(input.email),
    phone: empty(input.phone),
    address_line_1: empty(input.address_line_1),
    state: empty(input.state),
    postal_code: empty(input.postal_code),
    city: empty(input.city),
    country: empty(input.country),
    industry: empty(input.industry),
    contact_name: empty(input.contact_name),
    contact_email: empty(input.contact_email),
    contact_phone: empty(input.contact_phone),
    job_title: empty(input.job_title),
    owner_user_id: empty(input.owner_user_id),
    status: input.status,
    match_score: input.match_score ? clamp(parseInt(input.match_score, 10), 0, 100) : null,
  };
}

/**
 * A newly picked lead owner must be a member of this workspace. An unchanged
 * owner is not re-checked, so a lead owned by someone who has since left can
 * still be edited.
 */
async function validateOwner(
  workspaceId: string,
  ownerUserId: string | undefined,
  previousOwner: string | null = null
): Promise<string | null> {
  if (!ownerUserId || ownerUserId === previousOwner) return null;
  return (await isWorkspaceMember(workspaceId, ownerUserId))
    ? null
    : "The owner must be a member of this workspace.";
}

export async function createLead(values: unknown): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.create");

  const ownerError = await validateOwner(ctx.workspace.id, parsed.data.owner_user_id);
  if (ownerError) return { error: ownerError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...toLeadRow(parsed.data),
      source: "manual",
      workspace_id: ctx.workspace.id,
      owner_user_id: parsed.data.owner_user_id || ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return { id: data.id };
}

export async function updateLead(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.update");

  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("leads")
    .select("owner_user_id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ owner_user_id: string | null }>();
  const ownerError = await validateOwner(
    ctx.workspace.id,
    parsed.data.owner_user_id,
    prev?.owner_user_id ?? null
  );
  if (ownerError) return { error: ownerError };

  const { error } = await supabase
    .from("leads")
    .update({ ...toLeadRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { id };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return {};
}

export interface ConvertOptions {
  createDeal?: boolean;
  pipelineId?: string | null;
  stageId?: string | null;
  dealValue?: string | null;
  currency?: string | null;
}

/**
 * Convert a lead into a Company (+Contact) and, optionally, a Deal. Replaces the
 * old approve-only flow; `approveLead` is a thin wrapper for back-compat.
 */
export async function convertLead(
  id: string,
  opts: ConvertOptions = {}
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.update");
  await requirePermission("companies.create");
  if (opts.createDeal) await requirePermission("deals.create");

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Lead>();
  if (!lead) return { error: "Lead not found." };
  if (lead.status === "converted") return { error: "Lead already converted." };

  const owner = lead.owner_user_id ?? ctx.userId;

  if (opts.createDeal) {
    const foreign = await findForeignReference(supabase, ctx.workspace.id, [
      ["deal_pipelines", opts.pipelineId],
      ["deal_stages", opts.stageId],
    ]);
    if (foreign) return { error: foreignReferenceError(foreign) };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      workspace_id: ctx.workspace.id,
      name: lead.company_name,
      website: lead.website,
      industry: lead.industry,
      phone: lead.phone,
      email: lead.email,
      address_line_1: lead.address_line_1,
      city: lead.city,
      country: lead.country,
      status: "lead",
      owner_user_id: owner,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (companyError) return { error: companyError.message };

  // Undo the partial conversion when a later insert fails, so a failed
  // convert never leaves an orphan company/contact behind while the lead still
  // reads as unconverted. Best-effort: the original error is what's returned.
  const rollback = async (contact: string | null, deal: string | null = null) => {
    if (deal) {
      await supabase
        .from("deals")
        .delete()
        .eq("id", deal)
        .eq("workspace_id", ctx.workspace.id);
    }
    if (contact) {
      await supabase
        .from("contacts")
        .delete()
        .eq("id", contact)
        .eq("workspace_id", ctx.workspace.id);
    }
    await supabase
      .from("companies")
      .delete()
      .eq("id", company.id)
      .eq("workspace_id", ctx.workspace.id);
  };

  // Only create a contact when we have a real person's name and the caller may
  // create contacts (previously a missing contacts.create silently dropped it).
  let contactId: string | null = null;
  if (lead.contact_name && (await can("contacts.create"))) {
    const parts = lead.contact_name.trim().split(/\s+/);
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: ctx.workspace.id,
        company_id: company.id,
        first_name: parts[0],
        last_name: parts.slice(1).join(" "),
        email: lead.contact_email,
        phone: lead.contact_phone,
        job_title: lead.job_title,
        is_primary: true,
        owner_user_id: owner,
        created_by: ctx.userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (contactError || !contact) {
      await rollback(null);
      return {
        error: `Could not create the contact: ${contactError?.message ?? "unknown error"}`,
      };
    }
    contactId = contact.id;
  }

  let dealId: string | null = null;
  if (opts.createDeal) {
    const value = opts.dealValue ? Number(opts.dealValue) : null;
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        workspace_id: ctx.workspace.id,
        name: lead.company_name,
        company_id: company.id,
        primary_contact_id: contactId,
        pipeline_id: opts.pipelineId || null,
        stage_id: opts.stageId || null,
        value: Number.isFinite(value) ? value : null,
        currency: opts.currency || "GBP",
        status: "open",
        source: lead.source,
        owner_user_id: owner,
        created_by: ctx.userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (dealError || !deal) {
      await rollback(contactId);
      return {
        error: `Could not create the deal: ${dealError?.message ?? "unknown error"}`,
      };
    }
    dealId = deal.id;
  }

  const { error } = await supabase
    .from("leads")
    .update({
      status: "converted",
      converted_company_id: company.id,
      converted_contact_id: contactId,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) {
    await rollback(contactId, dealId);
    return { error: error.message };
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: dealId
      ? `Lead converted to deal: ${lead.company_name}`
      : `Lead converted: ${lead.company_name}`,
    companyId: company.id,
    dealId,
    leadId: id,
  });

  revalidatePath("/leads");
  revalidatePath("/companies");
  if (dealId) revalidatePath("/deals");
  return { id: company.id };
}

/** Back-compat: approve = convert to company (+contact) without a deal. */
export async function approveLead(id: string): Promise<ActionResult> {
  return convertLead(id);
}

export async function rejectLead(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      status: "rejected",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return {};
}

export interface BulkResult {
  error?: string;
  count?: number;
}

export async function bulkApproveLeads(ids: string[]): Promise<BulkResult> {
  // Parallel: convertLead is per-lead and doesn't share DB rows across the
  // batch, so we don't need serial execution. requireAuthContext /
  // requirePermission are per-request cached, so the Promise.all only fans
  // out the DB writes — cutting an N-lead batch from 5×N sequential
  // round-trips to roughly 5×parallel.
  const results = await Promise.all(ids.map((id) => convertLead(id)));
  const count = results.filter((r) => !r.error).length;
  revalidatePath("/leads");
  return { count };
}

export async function bulkRejectLeads(ids: string[]): Promise<BulkResult> {
  const results = await Promise.all(ids.map((id) => rejectLead(id)));
  const count = results.filter((r) => !r.error).length;
  revalidatePath("/leads");
  return { count };
}
