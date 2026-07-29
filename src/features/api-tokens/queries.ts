import { createClient } from "@/lib/supabase/server";

export interface ApiTokenListItem {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export async function getApiTokens(
  workspaceMemberId: string
): Promise<ApiTokenListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, last_used_at, created_at")
    .eq("workspace_member_id", workspaceMemberId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ApiTokenListItem[];
}
