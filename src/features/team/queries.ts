import { createClient } from "@/lib/supabase/server";
import type { WorkspaceMember, Profile } from "@/lib/db/types";

export interface MemberWithProfile extends WorkspaceMember {
  profile: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
}

export async function getMembers(
  workspaceId: string
): Promise<MemberWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select(
      "*, profile:profiles(id, full_name, email, avatar_url)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return (data ?? []) as MemberWithProfile[];
}

export interface MemberOption {
  userId: string;
  name: string;
}

/** Member options for assignee selects. */
export async function getMemberOptions(
  workspaceId: string
): Promise<MemberOption[]> {
  const members = await getMembers(workspaceId);
  return members.map((m) => ({
    userId: m.user_id,
    name: m.profile?.full_name || m.profile?.email || "Unknown",
  }));
}
