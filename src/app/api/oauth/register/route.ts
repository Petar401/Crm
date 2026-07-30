import { registerClient } from "@/features/oauth/store";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function isValidRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length === 0) return false;
  try {
    const url = new URL(uri);
    // Only http(s) redirect targets. Loopback http is how native clients (e.g.
    // Claude Desktop) receive the code; https for hosted callbacks.
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591). Open registration: any
 * client may register, but it can only ever act on behalf of a user who
 * subsequently logs in and consents, and redemption is locked to the exact
 * redirect URIs registered here.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("invalid_client_metadata", "Body must be JSON");
  }

  const meta = (body ?? {}) as Record<string, unknown>;
  const redirectUris = meta.redirect_uris;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return error("invalid_redirect_uri", "redirect_uris is required");
  }
  if (!redirectUris.every(isValidRedirectUri)) {
    return error("invalid_redirect_uri", "redirect_uris must be http(s) URLs");
  }

  const authMethod =
    typeof meta.token_endpoint_auth_method === "string"
      ? meta.token_endpoint_auth_method
      : "none";

  try {
    const client = await registerClient({
      redirect_uris: redirectUris,
      client_name:
        typeof meta.client_name === "string" ? meta.client_name : null,
      grant_types: Array.isArray(meta.grant_types)
        ? (meta.grant_types as string[])
        : undefined,
      response_types: Array.isArray(meta.response_types)
        ? (meta.response_types as string[])
        : undefined,
      token_endpoint_auth_method: authMethod,
      scope: typeof meta.scope === "string" ? meta.scope : "mcp",
    });

    return Response.json(
      {
        client_id: client.client_id,
        ...(client.client_secret
          ? { client_secret: client.client_secret, client_secret_expires_at: 0 }
          : {}),
        client_id_issued_at: Math.floor(
          new Date(client.created_at).getTime() / 1000
        ),
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        scope: client.scope,
      },
      { status: 201, headers: { ...CORS, "cache-control": "no-store" } }
    );
  } catch {
    return error("invalid_client_metadata", "Could not register client");
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

function error(code: string, description: string): Response {
  return Response.json(
    { error: code, error_description: description },
    { status: 400, headers: { ...CORS, "cache-control": "no-store" } }
  );
}
