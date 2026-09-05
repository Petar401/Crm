import { createClient } from "@/lib/supabase/server";
import type { WorkspaceOnboarding } from "@/lib/db/types";

export async function getOnboardingState(
  workspaceId: string
): Promise<WorkspaceOnboarding | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_onboarding")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceOnboarding>();
  return data ?? null;
}
