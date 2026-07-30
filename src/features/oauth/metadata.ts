import { getPublicOrigin } from "mcp-handler";

/**
 * The single protected MCP resource this authorization server issues tokens for.
 * Bound into tokens per RFC 8707 (Resource Indicators).
 */
export function mcpResource(origin: string): string {
  return `${origin}/api/mcp`;
}

/** Scopes advertised and granted. Fine-grained authorization is still enforced
 * per-tool by `requirePermission` based on the member's role, so a single
 * coarse scope is sufficient here. */
export const OAUTH_SCOPES = ["mcp"] as const;

/** OAuth 2.0 Protected Resource Metadata (RFC 9728). */
export function protectedResourceMetadata(request: Request) {
  const origin = getPublicOrigin(request);
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [...OAUTH_SCOPES],
    resource_name: "CRM",
    resource_documentation: `${origin}/settings`,
  };
}

/** OAuth 2.0 Authorization Server Metadata (RFC 8414). */
export function authorizationServerMetadata(request: Request) {
  const origin = getPublicOrigin(request);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: [...OAUTH_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  };
}
