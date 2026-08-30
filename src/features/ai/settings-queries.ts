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
 *
 * Decryption can throw (e.g. AI_KEY_ENCRYPTION_SECRET missing/rotated on the
 * deployment) — this is called directly from several Server Component page
 * renders, so a throw here would crash the whole page. Treat a broken stored
 * key the same as "not configured" rather than letting it propagate.
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
    try {
      return {
        provider: data.provider,
        apiKey: decryptSecret(data.encrypted_api_key),
        model: data.model,
      };
    } catch (e) {
      console.error(
        `Failed to decrypt AI API key for workspace ${workspaceId}:`,
        e
      );
      return null;
    }
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

/**
 * Whether AI_KEY_ENCRYPTION_SECRET is present and well-formed on this
 * deployment. Checks shape only — never touches stored secret material.
 * Used to tell Settings apart "nobody has configured AI yet" from "the
 * server itself is misconfigured and needs an administrator."
 */
export function isAiEncryptionKeyConfigured(): boolean {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  return !!secret && /^[0-9a-f]{64}$/i.test(secret);
}
