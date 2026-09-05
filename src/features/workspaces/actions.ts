"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireAuthContext,
} from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { auditLog } from "@/features/audit/log";
import {
  createWorkspaceSchema,
  inviteToWorkspaceSchema,
} from "@/features/workspaces/schemas";

export interface ActionResult {
  error?: string;
  workspaceId?: string;
}

/**
 * Sets the active workspace cookie. Kept as a helper so both the switcher and
 * the wizard/invitation flows write it the same way.
 */
async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createWorkspaceAction(values: unknown): Promise<ActionResult> {
  const parsed = createWorkspaceSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc(
    "create_workspace_for_current_user",
    {
      workspace_name: parsed.data.name,
      industry: parsed.data.industry ?? null,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      locale: parsed.data.locale,
    }
  );
  if (error) return { error: error.message };

  const workspaceId = data as string;
  await setActiveWorkspaceCookie(workspaceId);

  await auditLog({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.created",
    entityType: "workspace",
    entityId: workspaceId,
    after: {
      name: parsed.data.name,
      industry: parsed.data.industry,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      locale: parsed.data.locale,
    },
  });

  revalidatePath("/", "layout");
  return { workspaceId };
}

export async function setActiveWorkspaceAction(
  workspaceId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!membership) return { error: "You are not a member of that workspace." };

  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/", "layout");
  return { workspaceId };
}

export async function inviteToWorkspaceAction(
  values: unknown
): Promise<ActionResult & { token?: string }> {
  const parsed = inviteToWorkspaceSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("team.invite");

  const supabase = await createClient();
  const email = parsed.data.email.toLowerCase();

  let roleId: string | null = null;
  if (parsed.data.roleName) {
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("workspace_id", ctx.workspace.id)
      .eq("name", parsed.data.roleName)
      .maybeSingle<{ id: string }>();
    roleId = role?.id ?? null;
  }

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: ctx.workspace.id,
    email,
    role_id: roleId,
    token,
    invited_by: ctx.userId,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "That email already has a pending invitation." };
    }
    return { error: error.message };
  }

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "invitation.created",
    entityType: "invitation",
    after: { email, role_id: roleId },
  });

  revalidatePath("/settings");
  return { token };
}

export async function acceptInvitationAction(
  token: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);

  const { data, error } = await supabase.rpc("accept_workspace_invitation", {
    p_token: token,
  });
  if (error) return { error: error.message };

  const workspaceId = data as string;
  await setActiveWorkspaceCookie(workspaceId);

  await auditLog({
    workspaceId,
    actorUserId: user.id,
    action: "invitation.accepted",
    entityType: "invitation",
  });

  revalidatePath("/", "layout");
  return { workspaceId };
}

export async function revokeInvitationAction(
  invitationId: string
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("team.invite");

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: invitationId,
  });

  revalidatePath("/settings");
  return {};
}

/**
 * Best-effort backfill: on first launch of a legacy account that has multiple
 * `Owner` roles or is missing them, this stitches the named-role catalog onto
 * the workspace. Uses the admin client so it can bypass the "team.edit_roles"
 * gate. Called opportunistically from the topbar bootstrap.
 */
export async function ensureNamedRolesAction(workspaceId: string): Promise<void> {
  const admin = createAdminClient();
  const roleNames = ["Owner", "Admin", "Manager", "Sales Rep", "Read-only"];
  for (const name of roleNames) {
    await admin
      .from("roles")
      .insert({ workspace_id: workspaceId, name })
      .select()
      .maybeSingle();
  }
}
