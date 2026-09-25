import {
  consumeAuthorizationCode,
  getClient,
  issueTokens,
  rotateRefreshToken,
  type IssuedTokens,
} from "@/features/oauth/store";
import { verifyPkce } from "@/features/oauth/pkce";
import {
  parseBasicClientAuth,
  verifyClientSecret,
} from "@/features/oauth/client-auth";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

/**
 * OAuth 2.0 token endpoint (RFC 6749) for public clients using PKCE. Handles the
 * `authorization_code` and `refresh_token` grants. Access tokens returned here
 * are the bearer credential the connector sends to `/api/mcp`. Clients that
 * registered as confidential must also authenticate with their secret (form
 * `client_secret` or HTTP Basic).
 */
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", "Expected form-encoded body");
  }

  const grantType = str(form.get("grant_type"));
  const basic = parseBasicClientAuth(request.headers.get("authorization"));
  const creds: ClientCredentials = {
    clientId: str(form.get("client_id")) || basic?.clientId || "",
    clientSecret: str(form.get("client_secret")) || basic?.clientSecret || "",
  };

  if (grantType === "authorization_code") {
    return handleAuthorizationCode(form, creds);
  }
  if (grantType === "refresh_token") {
    return handleRefresh(form, creds);
  }
  return oauthError("unsupported_grant_type", "Unsupported grant_type");
}

interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

async function handleAuthorizationCode(
  form: FormData,
  creds: ClientCredentials
): Promise<Response> {
  const code = str(form.get("code"));
  const redirectUri = str(form.get("redirect_uri"));
  const clientId = creds.clientId;
  const codeVerifier = str(form.get("code_verifier"));

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return oauthError(
      "invalid_request",
      "code, redirect_uri, client_id and code_verifier are required"
    );
  }

  // Single-use: this atomically burns the code. Any subsequent check failure
  // still leaves it consumed, so a stolen code cannot be retried.
  const bound = await consumeAuthorizationCode(code);
  if (!bound) return oauthError("invalid_grant", "Invalid or expired code");

  if (bound.client_id !== clientId || bound.redirect_uri !== redirectUri) {
    return oauthError("invalid_grant", "Code does not match this client");
  }

  if (!verifyPkce(codeVerifier, bound.code_challenge, bound.code_challenge_method)) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  const client = await getClient(clientId);
  if (!verifyClientSecret(creds.clientSecret, client?.client_secret_hash)) {
    return oauthError("invalid_client", "Client authentication failed", 401);
  }
  const tokens = await issueTokens({
    clientId: bound.client_id,
    clientName: client?.client_name ?? null,
    workspaceMemberId: bound.workspace_member_id,
    workspaceId: bound.workspace_id,
    scope: bound.scope,
    resource: bound.resource,
  });

  return tokenResponse(tokens);
}

async function handleRefresh(
  form: FormData,
  creds: ClientCredentials
): Promise<Response> {
  const refreshToken = str(form.get("refresh_token"));
  const clientId = creds.clientId;
  if (!refreshToken) {
    return oauthError("invalid_request", "refresh_token is required");
  }

  // The grant is bound to its client inside rotateRefreshToken; a confidential
  // client must additionally prove it holds its secret before rotating.
  const tokens = await rotateRefreshToken(
    refreshToken,
    clientId || undefined,
    async (grantClientId) => {
      const client = await getClient(grantClientId);
      return verifyClientSecret(creds.clientSecret, client?.client_secret_hash);
    }
  );
  if (!tokens) return oauthError("invalid_grant", "Invalid refresh token");

  return tokenResponse(tokens);
}

function tokenResponse(tokens: IssuedTokens): Response {
  return Response.json(
    {
      access_token: tokens.access_token,
      token_type: "Bearer",
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope ?? undefined,
    },
    { headers: { ...CORS, "cache-control": "no-store", pragma: "no-cache" } }
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function oauthError(
  code: string,
  description: string,
  status = 400
): Response {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: { ...CORS, "cache-control": "no-store" } }
  );
}
