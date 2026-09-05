import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth/session";
import type { Workspace, WorkspaceInvitation } from "@/lib/db/types";

export interface MembershipRow {
  workspace: Workspace;
  is_full_access: boolean;
  role_id: string | null;
}

/** Every workspace the current user belongs to, in join order. */
export async function getMyWorkspaces(): Promise<MembershipRow[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("is_full_access, role_id, workspace:workspaces(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Array<{
    is_full_access: boolean;
    role_id: string | null;
    workspace: Workspace | Workspace[] | null;
  }>;

  return rows
    .map((r) => {
      const ws = Array.isArray(r.workspace) ? r.workspace[0] : r.workspace;
      return ws
        ? { workspace: ws, is_full_access: r.is_full_access, role_id: r.role_id }
        : null;
    })
    .filter((r): r is MembershipRow => r !== null);
}

/** Pending invitations addressed to the current user's email. */
export async function getMyPendingInvitations(): Promise<
  Array<WorkspaceInvitation & { workspace_name: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return [];

  const { data } = await supabase
    .from("workspace_invitations")
    .select("*, workspaces(name)")
    .is("accepted_at", null)
    .ilike("email", user.email)
    .gt("expires_at", new Date().toISOString());

  return (data ?? []).map((row: WorkspaceInvitation & { workspaces?: { name: string } | { name: string }[] | null }) => {
    const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    return { ...row, workspace_name: ws?.name ?? "" };
  });
}

/** Invitations issued by the current workspace. */
export async function getWorkspaceInvitations(
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as WorkspaceInvitation[];
}
