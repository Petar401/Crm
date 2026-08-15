import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/secret-box";
import type { WorkspaceAiSettings } from "@/lib/db/types";

export interface AiSettingsSummary {
  keyPreview: string;
  updatedAt: string;
}

/** RLS-scoped read for display in Settings — never returns the decrypted key. */
export async function getWorkspaceAiSettings(
  workspaceId: string
): Promise<AiSettingsSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_ai_settings")
    .select("key_preview, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle<Pick<WorkspaceAiSettings, "key_preview" | "updated_at">>();
  if (!data) return null;
  return { keyPreview: data.key_preview, updatedAt: data.updated_at };
}

/**
 * Resolves the Groq API key to use for a workspace: a stored per-workspace
 * key if one is set, otherwise the global GROQ_API_KEY env var fallback.
 * Uses the service-role client so it also works from the cron route, which
 * has no user session to read the RLS-scoped row through.
 */
export async function resolveGroqApiKey(
  workspaceId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_ai_settings")
    .select("encrypted_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle<Pick<WorkspaceAiSettings, "encrypted_api_key">>();
  if (data?.encrypted_api_key) {
    return decryptSecret(data.encrypted_api_key);
  }
  return process.env.GROQ_API_KEY ?? null;
}

/** Whether AI features are usable for this workspace (a Groq key resolves). */
export async function isAiConfigured(workspaceId: string): Promise<boolean> {
  return !!(await resolveGroqApiKey(workspaceId));
}

/** Whether the deployment has a global fallback key configured. */
export function hasEnvFallbackKey(): boolean {
  return !!process.env.GROQ_API_KEY;
}
