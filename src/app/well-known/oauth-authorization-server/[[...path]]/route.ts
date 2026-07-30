import { metadataCorsOptionsRequestHandler } from "mcp-handler";

import { authorizationServerMetadata } from "@/features/oauth/metadata";

export const dynamic = "force-dynamic";

/**
 * RFC 8414 Authorization Server Metadata. Advertises the authorize, token, and
 * dynamic-registration endpoints so OAuth clients can discover and complete the
 * flow. Optional catch-all so both the bare well-known path and any
 * resource-suffixed probe resolve. Reached via the `next.config.ts` rewrite.
 */
export function GET(request: Request): Response {
  return Response.json(authorizationServerMetadata(request), {
    headers: { "access-control-allow-origin": "*" },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
