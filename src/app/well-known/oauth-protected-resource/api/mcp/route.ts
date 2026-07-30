import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

export const dynamic = "force-dynamic";

/**
 * RFC 9728 protected-resource metadata. This CRM authenticates MCP clients with
 * personal access tokens rather than an OAuth authorization server, so no
 * `authorization_servers` are advertised — clients should send the token minted
 * in Settings → Connectors as a bearer credential.
 *
 * Served from a non-dotted `well-known` segment and reached via the rewrite in
 * `next.config.ts`, because the App Router does not register routes inside a
 * dot-prefixed `.well-known` directory.
 */
export function GET(request: Request): Response {
  const origin = getPublicOrigin(request);

  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      bearer_methods_supported: ["header"],
      resource_name: "CRM",
      resource_documentation: `${origin}/settings`,
    },
    { headers: { "access-control-allow-origin": "*" } }
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
