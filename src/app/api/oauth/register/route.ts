import { registerClient } from "@/features/oauth/store";

export const dynamic = "force-dynamic";

// CORS: intentionally not `*`. Dynamic Client Registration is called
// server-to-server by MCP clients (Claude Desktop et al.), which do not send
// an Origin header — those requests succeed as before. Browsers only get a
// permissive preflight when the request originates from the same origin as
// this server, which stops a random web page from JSON-POSTing here to
// pre-register an attacker-controlled redirect_uri.
function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const allowed = origin === url.origin ? origin : "null";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

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
  const cors = corsHeadersFor(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("invalid_client_metadata", "Body must be JSON", cors);
  }

  const meta = (body ?? {}) as Record<string, unknown>;
  const redirectUris = meta.redirect_uris;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return error("invalid_redirect_uri", "redirect_uris is required", cors);
  }
  if (!redirectUris.every(isValidRedirectUri)) {
    return error(
      "invalid_redirect_uri",
      "redirect_uris must be http(s) URLs",
      cors
    );
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
      { status: 201, headers: { ...cors, "cache-control": "no-store" } }
    );
  } catch {
    return error("invalid_client_metadata", "Could not register client", cors);
  }
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
}

function error(
  code: string,
  description: string,
  cors: Record<string, string>
): Response {
  return Response.json(
    { error: code, error_description: description },
    { status: 400, headers: { ...cors, "cache-control": "no-store" } }
  );
}
