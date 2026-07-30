import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Lifetimes. Authorization codes are single-use and short; access tokens are
 * refreshed hourly; refresh tokens last a month. */
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TOKEN_TTL_S = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

// ---------------------------------------------------------------- clients

export interface OAuthClient {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
}

export interface RegisterClientInput {
  redirect_uris: string[];
  client_name?: string | null;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string | null;
}

export interface RegisteredClient extends OAuthClient {
  response_types: string[];
  created_at: string;
  /** Present only for confidential clients — returned once at registration. */
  client_secret?: string;
}

export async function registerClient(
  input: RegisterClientInput
): Promise<RegisteredClient> {
  const admin = createAdminClient();
  const client_id = randomToken("crm_client");

  const authMethod = input.token_endpoint_auth_method ?? "none";
  const isConfidential = authMethod !== "none";
  const client_secret = isConfidential ? randomToken("crm_cs") : undefined;

  const row = {
    client_id,
    client_secret_hash: client_secret ? sha256(client_secret) : null,
    client_name: input.client_name ?? null,
    redirect_uris: input.redirect_uris,
    grant_types: input.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: input.response_types ?? ["code"],
    token_endpoint_auth_method: authMethod,
    scope: input.scope ?? "mcp",
  };

  const { data, error } = await admin
    .from("oauth_clients")
    .insert(row)
    .select("*")
    .single<RegisteredClient>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not register client");
  }

  return client_secret ? { ...data, client_secret } : data;
}

export async function getClient(
  clientId: string
): Promise<OAuthClient | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("oauth_clients")
    .select(
      "client_id, client_secret_hash, client_name, redirect_uris, grant_types, token_endpoint_auth_method, scope"
    )
    .eq("client_id", clientId)
    .maybeSingle<OAuthClient>();
  return data ?? null;
}

// ------------------------------------------------------- authorization codes

export interface IssueCodeInput {
  clientId: string;
  workspaceMemberId: string;
  workspaceId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string | null;
  resource: string | null;
}

/** Creates a single-use authorization code and returns the plaintext to embed
 * in the redirect. Only its hash is stored. */
export async function issueAuthorizationCode(
  input: IssueCodeInput
): Promise<string> {
  const admin = createAdminClient();
  const code = randomToken("crm_ac");
  const { error } = await admin.from("oauth_authorization_codes").insert({
    code_hash: sha256(code),
    client_id: input.clientId,
    workspace_member_id: input.workspaceMemberId,
    workspace_id: input.workspaceId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    scope: input.scope,
    resource: input.resource,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export interface ConsumedCode {
  client_id: string;
  workspace_member_id: string;
  workspace_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  resource: string | null;
}

/**
 * Atomically marks the code consumed and returns its binding — but only if it
 * was still unconsumed and unexpired. The `eq("consumed", false)` guard in the
 * UPDATE makes redemption single-use even under concurrent requests.
 */
export async function consumeAuthorizationCode(
  code: string
): Promise<ConsumedCode | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("oauth_authorization_codes")
    .update({ consumed: true })
    .eq("code_hash", sha256(code))
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .select(
      "client_id, workspace_member_id, workspace_id, redirect_uri, code_challenge, code_challenge_method, scope, resource"
    )
    .maybeSingle<ConsumedCode>();
  return data ?? null;
}

// --------------------------------------------------------------- tokens

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string | null;
}

interface IssueTokensInput {
  clientId: string;
  clientName: string | null;
  workspaceMemberId: string;
  workspaceId: string;
  scope: string | null;
  resource: string | null;
}

export async function issueTokens(
  input: IssueTokensInput
): Promise<IssuedTokens> {
  const admin = createAdminClient();
  const access_token = randomToken("crm_at");
  const refresh_token = randomToken("crm_rt");
  const now = Date.now();

  const { error } = await admin.from("oauth_access_tokens").insert({
    token_hash: sha256(access_token),
    refresh_token_hash: sha256(refresh_token),
    client_id: input.clientId,
    client_name: input.clientName,
    workspace_member_id: input.workspaceMemberId,
    workspace_id: input.workspaceId,
    scope: input.scope,
    resource: input.resource,
    expires_at: new Date(now + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TOKEN_TTL_S,
    scope: input.scope,
  };
}

/**
 * Rotates a refresh token: validates it (exists, unexpired), then replaces both
 * the access and refresh token hashes on the same grant row and returns the new
 * plaintext pair. Returns null for an unknown or expired refresh token.
 */
export async function rotateRefreshToken(
  refreshToken: string,
  expectedClientId?: string
): Promise<IssuedTokens | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("oauth_access_tokens")
    .select("id, scope, client_id, refresh_expires_at")
    .eq("refresh_token_hash", sha256(refreshToken))
    .maybeSingle<{
      id: string;
      scope: string | null;
      client_id: string;
      refresh_expires_at: string | null;
    }>();

  if (!row) return null;
  if (expectedClientId && row.client_id !== expectedClientId) return null;
  if (row.refresh_expires_at && new Date(row.refresh_expires_at) < new Date()) {
    return null;
  }

  const access_token = randomToken("crm_at");
  const refresh_token = randomToken("crm_rt");
  const now = Date.now();

  const { error } = await admin
    .from("oauth_access_tokens")
    .update({
      token_hash: sha256(access_token),
      refresh_token_hash: sha256(refresh_token),
      expires_at: new Date(now + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TOKEN_TTL_S,
    scope: row.scope,
  };
}

/**
 * Resolves an OAuth access token to its workspace member, or null if unknown or
 * expired. Touches `last_used_at` so Settings can show connector activity.
 */
export async function resolveAccessToken(
  accessToken: string
): Promise<{ workspaceMemberId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("oauth_access_tokens")
    .select("id, workspace_member_id, expires_at")
    .eq("token_hash", sha256(accessToken))
    .maybeSingle<{ id: string; workspace_member_id: string; expires_at: string }>();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  await admin
    .from("oauth_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { workspaceMemberId: data.workspace_member_id };
}
