"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/constants/permissions";
import {
  getMemberPermissionState,
  type MemberPermissionState,
} from "@/features/permissions/queries";
import { ROLE_TEMPLATES, type RoleName } from "@/features/permissions/role-templates";
import { auditLog } from "@/features/audit/log";
import type { WorkspaceMember } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
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

  const { data: member } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<WorkspaceMember>();

  if (!member) return { error: "Member not found." };

  if (member.user_id === ctx.workspace.created_by && !parsed.data.isFullAccess) {
    return { error: "The workspace owner must keep full access." };
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ is_full_access: parsed.data.isFullAccess })
    .eq("id", member.id)
    .eq("workspace_id", ctx.workspace.id);

  if (updateError) return { error: updateError.message };

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

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "member.permissions_updated",
    entityType: "member",
    entityId: member.id,
    after: {
      is_full_access: parsed.data.isFullAccess,
      permissions: parsed.data.permissions,
    },
  });

  revalidatePath("/settings");
  return {};
}

const createRoleSchema = z.object({
  name: z.string().min(1).max(60),
  templateName: z.string().optional(),
});

export async function createRole(values: unknown): Promise<ActionResult> {
  const parsed = createRoleSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("team.edit_roles");

  const supabase = await createClient();
  const { data: role, error } = await supabase
    .from("roles")
    .insert({ workspace_id: ctx.workspace.id, name: parsed.data.name })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  const template = parsed.data.templateName as RoleName | undefined;
  const keys: PermissionKey[] =
    template && template in ROLE_TEMPLATES ? ROLE_TEMPLATES[template] : [];
  if (keys.length > 0) {
    await supabase.from("role_permissions").insert(
      keys.map((key) => ({
        role_id: role.id,
        permission_key: key,
        allowed: true,
      }))
    );
  }

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "role.created",
    entityType: "role",
    entityId: role.id,
    after: { name: parsed.data.name, template },
  });

  revalidatePath("/settings");
  return { id: role.id };
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("team.edit_roles");

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("name, is_default")
    .eq("id", roleId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ name: string; is_default: boolean }>();

  if (!role) return { error: "Role not found." };
  if (role.is_default)
    return { error: "You can't delete the workspace's default role." };

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "role.deleted",
    entityType: "role",
    entityId: roleId,
    before: role,
  });

  revalidatePath("/settings");
  return {};
}

const assignRoleSchema = z.object({
  memberId: z.string().uuid(),
  roleId: z.string().uuid().nullable(),
});

export async function assignRoleToMember(values: unknown): Promise<ActionResult> {
  const parsed = assignRoleSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("team.edit_roles");

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role_id: parsed.data.roleId })
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "member.role_assigned",
    entityType: "member",
    entityId: parsed.data.memberId,
    after: { role_id: parsed.data.roleId },
  });

  revalidatePath("/settings");
  return {};
}
