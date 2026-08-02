import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/safe-next";

/**
 * Exchanges the PKCE `code` from a Supabase auth email link (e.g. password
 * recovery) for a session cookie, then forwards the user to `next`.
 * Configured as the `redirectTo` target in `forgotPasswordAction`.
 *
 * `next` is sanitized through `safeInternalPath` — an attacker cannot craft a
 * value like `@evil.com` or `//evil.com` and turn this into an open redirect
 * after a legitimate code exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/reset-password");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_reset_link`);
}
