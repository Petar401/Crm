"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";

export interface ActionResult {
  error?: string;
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
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

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: ctx.workspace.id,
    user_id: userId,
    role: "member",
    role_id: role?.id ?? null,
    is_full_access: true,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      return { error: "This person is already a member of the workspace." };
    }
    return { error: memberError.message };
  }

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

  revalidatePath("/settings");
  return {};
}
