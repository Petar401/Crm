"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { notifyWorkspaceEvent } from "@/lib/notifications";
import { dealSchema } from "@/features/deals/schemas";
import type { DealInput } from "@/features/deals/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

/** Maps form values to DB columns, turning empty strings into nulls. */
function toRow(data: DealInput) {
  const emptyToNull = (v: string | undefined) => (v && v !== "" ? v : null);
  const toNumber = (v: string | undefined) => {
    if (!v || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    name: data.name,
    company_id: data.company_id,
    primary_contact_id: emptyToNull(data.primary_contact_id),
    pipeline_id: emptyToNull(data.pipeline_id),
    stage_id: emptyToNull(data.stage_id),
    value: toNumber(data.value),
    currency: data.currency,
    probability: toNumber(data.probability),
    expected_close_date: emptyToNull(data.expected_close_date),
    status: data.status,
    source: data.source ?? null,
    next_step: data.next_step ?? null,
  };
}

export async function createDeal(values: unknown): Promise<ActionResult> {
  const parsed = dealSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("deals.create");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      ...toRow(parsed.data),
      workspace_id: ctx.workspace.id,
      owner_user_id: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Deal created: ${parsed.data.name}`,
    companyId: parsed.data.company_id,
    dealId: data.id,
  });

  notifyWorkspaceEvent({
    workspaceId: ctx.workspace.id,
    creatorUserId: ctx.userId,
    creatorName: ctx.profile?.full_name ?? ctx.email,
    entityType: "deal",
    entityTitle: parsed.data.name,
    workspaceName: ctx.workspace.name,
  }).catch(() => {});

  revalidatePath("/deals");
  return { id: data.id };
}

export async function updateDeal(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = dealSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("deals.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { id };
}

export async function moveDealStage(
  dealId: string,
  stageId: string,
  stageName: string
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("deals.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stageId })
    .eq("id", dealId)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "stage_changed",
    title: `Moved to ${stageName}`,
    dealId,
  });

  revalidatePath("/deals");
  return { id: dealId };
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("deals.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/deals");
  return {};
}
