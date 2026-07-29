import { createMcpHandler } from "mcp-handler";

import { runWithAuthOverride } from "@/lib/auth/session";
import { authContextFromToken } from "@/features/mcp/auth";
import { registerCrmTools } from "@/features/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const mcpHandler = createMcpHandler(
  (server) => registerCrmTools(server),
  { serverInfo: { name: "crm", version: "1.0.0" } },
  { basePath: "/api/mcp" }
);

function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({ error: "invalid_token" }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp/mcp"`,
      },
    }
  );
}

/**
 * Authenticates the bearer personal access token, then runs the MCP handler
 * with that member's auth context installed. Every tool underneath calls the
 * app's existing queries and server actions, so `requirePermission` still
 * gates writes exactly as it does in the UI.
 */
async function handler(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) return unauthorized(request);

  const ctx = await authContextFromToken(token);
  if (!ctx) return unauthorized(request);

  return runWithAuthOverride(ctx, () => mcpHandler(request));
}

export { handler as GET, handler as POST, handler as DELETE };
