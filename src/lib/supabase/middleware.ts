import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth"];

/**
 * Routes that authenticate themselves with a bearer token instead of the
 * cookie session (MCP connector, its RFC 9728 metadata, and the cron route).
 * Redirecting these to /login would break non-browser clients, which don't
 * follow redirects and would silently receive HTML instead of JSON.
 */
const BEARER_AUTH_PATHS = [
  "/api/mcp",
  "/api/cron",
  "/.well-known/oauth-protected-resource",
];

/**
 * Refreshes the Supabase session on every request and guards protected routes.
 * Unauthenticated users hitting a protected route are redirected to /login.
 */
export async function updateSession(request: NextRequest) {
  if (
    BEARER_AUTH_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
