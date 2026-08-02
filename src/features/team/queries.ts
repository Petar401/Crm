import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT } from "@/lib/constants/list";
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
    .order("created_at", { ascending: true })
    .limit(LIST_LIMIT);
  return (data ?? []) as MemberWithProfile[];
}

export interface MemberOption {
  userId: string;
  name: string;
}

/**
 * Member options for assignee selects. Selects a slim column set instead of
 * `*` — previously the caller pulled every member row (with the full profile
 * join) and threw away everything except id + name.
 */
export async function getMemberOptions(
  workspaceId: string
): Promise<MemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, profile:profiles(full_name, email)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(LIST_LIMIT);

  return ((data ?? []) as unknown as {
    user_id: string;
    profile: { full_name: string | null; email: string | null } | null;
  }[]).map((m) => ({
    userId: m.user_id,
    name: m.profile?.full_name || m.profile?.email || "Unknown",
  }));
}
