import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/security/secret-box";
import type { OAuthConfig } from "@/features/calendar-sync/config";

export interface StoredTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number; // ms epoch
  scope?: string;
  id_token?: string;
}

export function packTokens(t: StoredTokens): string {
  return encryptSecret(JSON.stringify(t));
}

export function unpackTokens(blob: string): StoredTokens {
  return JSON.parse(decryptSecret(blob)) as StoredTokens;
}

/**
 * Exchanges an OAuth authorization code for tokens. Provider-agnostic
 * since both Google and Microsoft speak standard OAuth 2.0 here.
 */
export async function exchangeCode(
  config: OAuthConfig,
  code: string
): Promise<StoredTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${detail}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: Date.now() + json.expires_in * 1000,
    scope: json.scope,
    id_token: json.id_token,
  };
}

export async function refreshTokens(
  config: OAuthConfig,
  existing: StoredTokens
): Promise<StoredTokens> {
  if (!existing.refresh_token) {
    throw new Error("No refresh token — reconnect the account");
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: existing.refresh_token,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${detail}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? existing.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
    scope: json.scope,
    id_token: json.id_token,
  };
}

/**
 * Ensures the returned access token is valid for at least the next 60s;
 * refreshes and re-persists the token blob if not.
 */
export async function ensureFreshAccessToken(
  config: OAuthConfig,
  tokens: StoredTokens,
  persist: (t: StoredTokens) => Promise<void>
): Promise<StoredTokens> {
  if (tokens.expires_at - Date.now() > 60_000) return tokens;
  const refreshed = await refreshTokens(config, tokens);
  await persist(refreshed);
  return refreshed;
}
