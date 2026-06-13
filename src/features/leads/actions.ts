"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
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
    business_description: input.business_description,
    target_categories: categories,
    location: input.location,
    country: input.country || null,
    frequency: input.frequency,
    auto_create: input.auto_create,
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

export async function createLead(values: unknown): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("leads.create");

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

  // Only create a contact when we have a real person's name.
  let contactId: string | null = null;
  if (lead.contact_name) {
    const parts = lead.contact_name.trim().split(/\s+/);
    const { data: contact } = await supabase
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
    contactId = contact?.id ?? null;
  }

  let dealId: string | null = null;
  if (opts.createDeal) {
    const value = opts.dealValue ? Number(opts.dealValue) : null;
    const { data: deal } = await supabase
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
    dealId = deal?.id ?? null;
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

  if (error) return { error: error.message };

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
  let count = 0;
  for (const id of ids) {
    const r = await convertLead(id);
    if (!r.error) count += 1;
  }
  revalidatePath("/leads");
  return { count };
}

export async function bulkRejectLeads(ids: string[]): Promise<BulkResult> {
  let count = 0;
  for (const id of ids) {
    const r = await rejectLead(id);
    if (!r.error) count += 1;
  }
  revalidatePath("/leads");
  return { count };
}
