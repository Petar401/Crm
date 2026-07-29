import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadAuthContextForUser, type AuthContext } from "@/lib/auth/session";

interface TokenRow {
  id: string;
  workspace_member_id: string;
}

/**
 * Resolves a personal access token to an auth context. Returns null for an
 * unknown or revoked token. Touches `last_used_at` so the Settings UI can show
 * whether a connector is live.
 */
export async function authContextFromToken(
  token: string
): Promise<AuthContext | null> {
  const token_hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("api_tokens")
    .select("id, workspace_member_id")
    .eq("token_hash", token_hash)
    .maybeSingle<TokenRow>();

  if (!row) return null;

  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("id", row.workspace_member_id)
    .maybeSingle<{ user_id: string }>();

  if (!member) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", member.user_id)
    .maybeSingle<{ email: string | null }>();

  const ctx = await loadAuthContextForUser(
    admin,
    member.user_id,
    profile?.email ?? ""
  );
  if (!ctx) return null;

  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return ctx;
}
