import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/secret-box";
import type { WorkspaceApolloSettings } from "@/lib/db/types";

export interface ApolloSettingsSummary {
  keyPreview: string;
  updatedAt: string;
}

/** RLS-scoped read for display in Settings — never returns the decrypted key. */
export async function getWorkspaceApolloSettings(
  workspaceId: string
): Promise<ApolloSettingsSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_apollo_settings")
    .select("key_preview, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle<Pick<WorkspaceApolloSettings, "key_preview" | "updated_at">>();
  if (!data) return null;
  return { keyPreview: data.key_preview, updatedAt: data.updated_at };
}

/**
 * Resolves the Apollo API key to use for a workspace. Unlike the AI key,
 * there is no global env-var fallback — Apollo is a paid, credit-metered
 * account, so every workspace must configure its own key.
 *
 * Uses the service-role client so this also works outside a user session.
 * Decryption can throw (e.g. AI_KEY_ENCRYPTION_SECRET missing/rotated) — treat
 * a broken stored key the same as "not configured" rather than propagating.
 */
export async function resolveApolloApiKey(
  workspaceId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_apollo_settings")
    .select("encrypted_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle<Pick<WorkspaceApolloSettings, "encrypted_api_key">>();
  if (!data?.encrypted_api_key) return null;
  try {
    return decryptSecret(data.encrypted_api_key);
  } catch (e) {
    console.error(
      `Failed to decrypt Apollo API key for workspace ${workspaceId}:`,
      e
    );
    return null;
  }
}

/** Whether Apollo features are usable for this workspace (a key resolves). */
export async function isApolloConfigured(workspaceId: string): Promise<boolean> {
  return !!(await resolveApolloApiKey(workspaceId));
}

/**
 * Whether AI_KEY_ENCRYPTION_SECRET is present and well-formed on this
 * deployment. Shared with the AI settings feature — this checks the shared
 * encryption-at-rest secret, not anything AI-specific.
 */
export function isApolloEncryptionKeyConfigured(): boolean {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  return !!secret && /^[0-9a-f]{64}$/i.test(secret);
}
