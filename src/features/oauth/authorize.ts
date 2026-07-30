import "server-only";

import { getClient, type OAuthClient } from "@/features/oauth/store";

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  resource?: string;
}

export type AuthorizeValidation =
  /** No usable client/redirect — must render an error, never redirect. */
  | { status: "invalid_client"; message: string }
  /** redirect_uri is registered, so failures can be reported back to it. */
  | {
      status: "error";
      redirectUri: string;
      state?: string;
      error: string;
      description: string;
    }
  | {
      status: "ok";
      client: OAuthClient;
      redirectUri: string;
      codeChallenge: string;
      codeChallengeMethod: string;
      scope: string | null;
      state?: string;
      resource?: string;
    };

/**
 * Validates an authorization request. The redirect_uri is checked against the
 * client's registered URIs *before* it is ever used as a redirect target, so a
 * request can never bounce a code (or an error) to an unregistered URI.
 */
export async function validateAuthorize(
  params: AuthorizeParams
): Promise<AuthorizeValidation> {
  const clientId = params.client_id?.trim();
  if (!clientId) {
    return { status: "invalid_client", message: "Missing client_id." };
  }

  const client = await getClient(clientId);
  if (!client) {
    return { status: "invalid_client", message: "Unknown client." };
  }

  const redirectUri = params.redirect_uri?.trim();
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return {
      status: "invalid_client",
      message: "The redirect URI is not registered for this client.",
    };
  }

  const state = params.state;

  if (params.response_type !== "code") {
    return {
      status: "error",
      redirectUri,
      state,
      error: "unsupported_response_type",
      description: "Only response_type=code is supported.",
    };
  }

  const codeChallenge = params.code_challenge?.trim();
  const codeChallengeMethod = params.code_challenge_method?.trim() || "S256";
  if (!codeChallenge) {
    return {
      status: "error",
      redirectUri,
      state,
      error: "invalid_request",
      description: "PKCE code_challenge is required.",
    };
  }
  if (codeChallengeMethod !== "S256") {
    return {
      status: "error",
      redirectUri,
      state,
      error: "invalid_request",
      description: "Only the S256 PKCE method is supported.",
    };
  }

  return {
    status: "ok",
    client,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope: params.scope ?? client.scope ?? "mcp",
    state,
    resource: params.resource,
  };
}

/** Appends query params to a redirect URI, preserving any it already has. */
export function redirectWith(
  redirectUri: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}
