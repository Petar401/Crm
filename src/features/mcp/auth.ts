import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadAuthContextForUser, type AuthContext } from "@/lib/auth/session";
import { resolveAccessToken } from "@/features/oauth/store";

/**
 * Resolves a bearer credential to an auth context. Accepts either an OAuth
 * access token minted through the authorization flow (Claude Desktop's
 * connector) or a personal access token from Settings → Connectors. Returns
 * null for an unknown, revoked, or expired credential.
 */
export async function authContextFromToken(
  token: string
): Promise<AuthContext | null> {
  const admin = createAdminClient();

  // OAuth access token first (issued via /api/oauth/token).
  const oauth = await resolveAccessToken(token);
  if (oauth) {
    return loadContextForMember(admin, oauth.workspaceMemberId);
  }

  // Fall back to a personal access token. Touches last_used_at so the Settings
  // UI can show whether a connector is live.
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { data: row } = await admin
    .from("api_tokens")
    .select("id, workspace_member_id")
    .eq("token_hash", token_hash)
    .maybeSingle<{ id: string; workspace_member_id: string }>();

  if (!row) return null;

  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return loadContextForMember(admin, row.workspace_member_id);
}

/** Loads the full auth context for a workspace member id (member → user →
 * profile/workspace joins), using the service-role client. */
async function loadContextForMember(
  admin: ReturnType<typeof createAdminClient>,
  workspaceMemberId: string
): Promise<AuthContext | null> {
  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("id", workspaceMemberId)
    .maybeSingle<{ user_id: string }>();

  if (!member) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", member.user_id)
    .maybeSingle<{ email: string | null }>();

  return loadAuthContextForUser(admin, member.user_id, profile?.email ?? "");
}
