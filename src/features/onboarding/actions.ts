"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { auditLog } from "@/features/audit/log";
import {
  createWorkspaceAction,
  inviteToWorkspaceAction,
} from "@/features/workspaces/actions";
import {
  profileStepSchema,
  invitesStepSchema,
  templateStepSchema,
} from "@/features/onboarding/schemas";
import { getTemplate, type TemplateKey } from "@/features/onboarding/templates";

export interface ActionResult {
  error?: string;
  workspaceId?: string;
}

/**
 * Wizard step 1: create the workspace and stamp the initial onboarding row.
 * Returns the new workspace id so the client can chain steps 2-4 against it.
 */
export async function onboardingCreateWorkspaceAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = profileStepSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const res = await createWorkspaceAction(parsed.data);
  if (res.error || !res.workspaceId) return { error: res.error };

  const supabase = await createClient();
  await supabase
    .from("workspace_onboarding")
    .upsert({
      workspace_id: res.workspaceId,
      completed_steps: [1],
    });

  return { workspaceId: res.workspaceId };
}

export async function onboardingInviteTeamAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = invitesStepSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();

  for (const row of parsed.data.invites) {
    const res = await inviteToWorkspaceAction(row);
    if (res.error && res.error !== "That email already has a pending invitation.") {
      return { error: res.error };
    }
  }

  await bumpStep(ctx.workspace.id, 2);
  return {};
}

export async function onboardingApplyTemplateAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = templateStepSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const template = getTemplate(parsed.data.templateKey as TemplateKey);
  const supabase = await createClient();

  for (const pipeline of template.extraPipelines) {
    const { data: p } = await supabase
      .from("deal_pipelines")
      .insert({ workspace_id: ctx.workspace.id, name: pipeline.name })
      .select("id")
      .single<{ id: string }>();
    if (!p) continue;
    const stages = pipeline.stages.map((st, i) => ({
      workspace_id: ctx.workspace.id,
      pipeline_id: p.id,
      name: st.name,
      color: st.color,
      position: i + 1,
    }));
    await supabase.from("deal_stages").insert(stages);
  }

  for (const c of template.sampleCompanies) {
    await supabase.from("companies").insert({
      workspace_id: ctx.workspace.id,
      name: c.name,
      industry: c.industry,
      website: c.website ?? null,
      created_by: ctx.userId,
      owner_user_id: ctx.userId,
    });
  }

  await supabase
    .from("workspace_onboarding")
    .update({ template_key: template.key })
    .eq("workspace_id", ctx.workspace.id);

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "onboarding.template_applied",
    after: { template: template.key },
  });

  await bumpStep(ctx.workspace.id, 3);
  return {};
}

export async function onboardingFinishAction(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  const supabase = await createClient();
  await supabase
    .from("workspace_onboarding")
    .update({
      completed_at: new Date().toISOString(),
      completed_steps: [1, 2, 3, 4],
    })
    .eq("workspace_id", ctx.workspace.id);
  revalidatePath("/", "layout");
  return {};
}

async function bumpStep(workspaceId: string, step: number): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_onboarding")
    .select("completed_steps")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ completed_steps: number[] }>();
  const current = new Set(data?.completed_steps ?? []);
  current.add(step);
  await supabase
    .from("workspace_onboarding")
    .upsert({
      workspace_id: workspaceId,
      completed_steps: Array.from(current).sort((a, b) => a - b),
    });
}
