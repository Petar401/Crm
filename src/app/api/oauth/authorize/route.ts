import { getPublicOrigin } from "mcp-handler";

import { getAuthContext } from "@/lib/auth/session";
import {
  validateAuthorize,
  redirectWith,
  type AuthorizeParams,
} from "@/features/oauth/authorize";
import { verifyOAuthCsrfToken } from "@/features/oauth/csrf";
import { issueAuthorizationCode } from "@/features/oauth/store";
import { mcpResource } from "@/features/oauth/metadata";

export const dynamic = "force-dynamic";

/**
 * Consent form submission target. Re-validates the authorization request
 * server-side (never trusting the posted fields for the security decision),
 * confirms a signed-in user, then either issues a single-use authorization code
 * or reports the denial back to the client's registered redirect URI.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const params: AuthorizeParams = {
    response_type: field(form, "response_type"),
    client_id: field(form, "client_id"),
    redirect_uri: field(form, "redirect_uri"),
    code_challenge: field(form, "code_challenge"),
    code_challenge_method: field(form, "code_challenge_method"),
    scope: field(form, "scope"),
    state: field(form, "state"),
    resource: field(form, "resource"),
  };
  const decision = field(form, "decision");

  const result = await validateAuthorize(params);

  if (result.status === "invalid_client") {
    return new Response(result.message, { status: 400 });
  }
  if (result.status === "error") {
    return see(
      redirectWith(result.redirectUri, {
        error: result.error,
        error_description: result.description,
        state: result.state,
      })
    );
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    const origin = getPublicOrigin(request);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    const next = `/oauth/authorize?${query.toString()}`;
    return see(`${origin}/login?next=${encodeURIComponent(next)}`);
  }

  // Session-bound CSRF check. A third-party site can render a hidden form that
  // POSTs to this endpoint with the OAuth params, but it cannot mint a token
  // that validates against this signed-in user, so the approval fails.
  const csrf = field(form, "csrf");
  if (!verifyOAuthCsrfToken(csrf, ctx.userId)) {
    return see(
      redirectWith(result.redirectUri, {
        error: "access_denied",
        error_description: "Missing or expired consent token",
        state: result.state,
      })
    );
  }

  if (decision !== "approve") {
    return see(
      redirectWith(result.redirectUri, {
        error: "access_denied",
        state: result.state,
      })
    );
  }

  const origin = getPublicOrigin(request);
  const code = await issueAuthorizationCode({
    clientId: result.client.client_id,
    workspaceMemberId: ctx.member.id,
    workspaceId: ctx.workspace.id,
    redirectUri: result.redirectUri,
    codeChallenge: result.codeChallenge,
    codeChallengeMethod: result.codeChallengeMethod,
    scope: result.scope,
    resource: result.resource ?? mcpResource(origin),
  });

  return see(
    redirectWith(result.redirectUri, { code, state: result.state })
  );
}

function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** 303 See Other so the browser issues a GET to the redirect target. */
function see(url: string): Response {
  return new Response(null, { status: 303, headers: { location: url } });
}
