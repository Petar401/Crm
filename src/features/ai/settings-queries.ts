import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/secret-box";
import type { AiProvider, WorkspaceAiSettings } from "@/lib/db/types";

export interface AiSettingsSummary {
  provider: AiProvider;
  model: string | null;
  keyPreview: string;
  updatedAt: string;
}

export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
}

/** RLS-scoped read for display in Settings — never returns the decrypted key. */
export async function getWorkspaceAiSettings(
  workspaceId: string
): Promise<AiSettingsSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_ai_settings")
    .select("provider, model, key_preview, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle<
      Pick<WorkspaceAiSettings, "provider" | "model" | "key_preview" | "updated_at">
    >();
  if (!data) return null;
  return {
    provider: data.provider,
    model: data.model,
    keyPreview: data.key_preview,
    updatedAt: data.updated_at,
  };
}

/**
 * Resolves the AI provider/key/model to use for a workspace: a stored
 * per-workspace choice if one is set, otherwise the global GROQ_API_KEY env
 * var fallback (Groq, default model). Uses the service-role client so it
 * also works from the cron route, which has no user session to read the
 * RLS-scoped row through.
 */
export async function resolveAiCredentials(
  workspaceId: string
): Promise<AiCredentials | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_ai_settings")
    .select("provider, encrypted_api_key, model")
    .eq("workspace_id", workspaceId)
    .maybeSingle<
      Pick<WorkspaceAiSettings, "provider" | "encrypted_api_key" | "model">
    >();
  if (data?.encrypted_api_key) {
    return {
      provider: data.provider,
      apiKey: decryptSecret(data.encrypted_api_key),
      model: data.model,
    };
  }
  const envKey = process.env.GROQ_API_KEY;
  if (!envKey) return null;
  return { provider: "groq", apiKey: envKey, model: null };
}

/** Whether AI features are usable for this workspace (credentials resolve). */
export async function isAiConfigured(workspaceId: string): Promise<boolean> {
  return !!(await resolveAiCredentials(workspaceId));
}

/** Whether the deployment has a global fallback key configured. */
export function hasEnvFallbackKey(): boolean {
  return !!process.env.GROQ_API_KEY;
}
