"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSION_KEYS } from "@/lib/constants/permissions";
import {
  getMemberPermissionState,
  type MemberPermissionState,
} from "@/features/permissions/queries";
import type { WorkspaceMember } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
}

/** Loads a member's editable permission state (for the settings panel). */
export async function loadMemberPermissionState(
  memberId: string
): Promise<MemberPermissionState | null> {
  const ctx = await requireAuthContext();
  await requirePermission("team.view");
  return getMemberPermissionState(ctx.workspace.id, memberId);
}

const saveSchema = z.object({
  memberId: z.string().uuid(),
  isFullAccess: z.boolean(),
  permissions: z.record(z.string(), z.boolean()),
});

/**
 * Persists a member's access: the full-access flag, plus explicit per-key
 * overrides when full access is off (overrides are cleared when it is on).
 */
export async function saveMemberPermissions(
  values: unknown
): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("team.edit_roles");

  const supabase = await createClient();

  // Confirm the target member belongs to this workspace.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<WorkspaceMember>();

  if (!member) return { error: "Member not found." };

  // Protect the workspace owner from being locked out.
  if (member.user_id === ctx.workspace.created_by && !parsed.data.isFullAccess) {
    return { error: "The workspace owner must keep full access." };
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ is_full_access: parsed.data.isFullAccess })
    .eq("id", member.id)
    .eq("workspace_id", ctx.workspace.id);

  if (updateError) return { error: updateError.message };

  // Always reset overrides, then write explicit ones when not full access.
  await supabase
    .from("member_permission_overrides")
    .delete()
    .eq("workspace_member_id", member.id);

  if (!parsed.data.isFullAccess) {
    const rows = PERMISSION_KEYS.map((key) => ({
      workspace_member_id: member.id,
      permission_key: key,
      allowed: parsed.data.permissions[key] ?? false,
    }));
    const { error: insertError } = await supabase
      .from("member_permission_overrides")
      .insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/settings");
  return {};
}
