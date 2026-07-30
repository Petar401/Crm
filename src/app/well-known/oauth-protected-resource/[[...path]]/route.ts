import { metadataCorsOptionsRequestHandler } from "mcp-handler";

import { protectedResourceMetadata } from "@/features/oauth/metadata";

export const dynamic = "force-dynamic";

/**
 * RFC 9728 Protected Resource Metadata for the MCP endpoint. Advertises this
 * app as the authorization server so OAuth clients (Claude Desktop) can begin
 * the authorization-code + PKCE flow.
 *
 * An optional catch-all so both the bare `/.well-known/oauth-protected-resource`
 * and the resource-suffixed `/.well-known/oauth-protected-resource/api/mcp`
 * probes resolve. Reached via the `next.config.ts` rewrite, since the App Router
 * does not register routes inside a dot-prefixed `.well-known` directory.
 */
export function GET(request: Request): Response {
  return Response.json(protectedResourceMetadata(request), {
    headers: { "access-control-allow-origin": "*" },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
