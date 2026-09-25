"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/auth/session";
import { can, requirePermission } from "@/lib/auth/permissions";
import { notify } from "@/features/notifications/emit";
import { auditLog } from "@/features/audit/log";

export interface ActionResult {
  error?: string;
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  /** Grant the full-access bypass. Needs `team.edit_roles`, like the toggle in
   * the permission editor. Off by default: the member gets the default role. */
  fullAccess: z.boolean().optional(),
});

/**
 * Invites a member to the current workspace. If the person already has an
 * account they are added directly; otherwise an invite email is sent (requires
 * SMTP configured in Supabase). Uses the service-role client server-side only.
 */
export async function inviteMember(values: unknown): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("team.invite");
  if (parsed.data.fullAccess && !(await can("team.edit_roles"))) {
    return { error: "You don't have permission to grant full access." };
  }

  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase();

  // Find an existing user with this email.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  let userId = profile?.id ?? null;

  if (!userId) {
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited?.user) {
      return {
        error:
          inviteError?.message ??
          "Could not invite this email. Check your Supabase email settings.",
      };
    }
    userId = invited.user.id;
  }

  // Look up the workspace's default role.
  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("is_default", true)
    .maybeSingle<{ id: string }>();

  // New members are governed by the default role (matching the signup and
  // invitation-accept paths, see 0015_signup_defaults.sql) unless the inviter
  // explicitly grants full access. Without a default role to fall back on, full
  // access is kept so the invitee isn't left with no permissions at all.
  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: ctx.workspace.id,
    user_id: userId,
    role: "member",
    role_id: role?.id ?? null,
    is_full_access: Boolean(parsed.data.fullAccess) || !role,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      return { error: "This person is already a member of the workspace." };
    }
    return { error: memberError.message };
  }

  await notify({
    workspaceId: ctx.workspace.id,
    userIds: [userId],
    kind: "workspace_invited",
    title: `You joined ${ctx.workspace.name}`,
    url: "/",
    actorUserId: ctx.userId,
  });

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "member.added",
    entityType: "member",
    entityId: userId,
    after: { email, fullAccess: Boolean(parsed.data.fullAccess) || !role },
  });

  revalidatePath("/settings");
  return {};
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("team.edit_roles");

  const supabase = await createClient();

  // Never remove the workspace owner.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ user_id: string }>();

  if (member?.user_id === ctx.workspace.created_by) {
    return { error: "You can't remove the workspace owner." };
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "member.removed",
    entityType: "member",
    entityId: memberId,
    before: member ?? undefined,
  });

  revalidatePath("/settings");
  return {};
}
