"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { campaignSchema } from "@/features/leads/schemas";
import { runCampaign } from "@/features/leads/generate";
import type { Lead, LeadCampaign } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
}

/** Map the string-based form input to campaign table columns. */
function toCampaignRow(input: ReturnType<typeof campaignSchema.parse>) {
  const categories = input.target_categories
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const max = input.max_results ? parseInt(input.max_results, 10) : 25;
  return {
    name: input.name,
    business_description: input.business_description,
    target_categories: categories,
    location: input.location,
    country: input.country || null,
    frequency: input.frequency,
    auto_create: input.auto_create,
    max_results: Math.max(1, Math.min(100, max)),
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

export async function approveLead(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("leads.update");
  await requirePermission("companies.create");

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Lead>();
  if (!lead) return { error: "Lead not found." };

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
      owner_user_id: ctx.userId,
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
        owner_user_id: ctx.userId,
        created_by: ctx.userId,
      })
      .select("id")
      .single<{ id: string }>();
    contactId = contact?.id ?? null;
  }

  const { error } = await supabase
    .from("leads")
    .update({
      status: "converted",
      converted_company_id: company.id,
      converted_contact_id: contactId,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Lead converted: ${lead.company_name}`,
    companyId: company.id,
  });

  revalidatePath("/leads");
  revalidatePath("/companies");
  return { id: company.id };
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
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return {};
}
