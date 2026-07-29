import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getAuthOverride } from "@/lib/auth/session";

/**
 * Server Supabase client bound to the request cookies. Use in Server
 * Components, Route Handlers, and Server Actions. Honors RLS via the user's
 * session.
 *
 * Under an MCP bearer-token request (see `runWithAuthOverride`), returns a
 * service-role client instead so existing queries and actions can run without
 * a cookie session. Workspace scoping is enforced in application code — every
 * query filters by `workspace_id` from the loaded auth context, and every
 * mutating action calls `requirePermission`.
 */
export async function createClient() {
  const override = getAuthOverride();
  if (override?.useServiceRole) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes the session.
          }
        },
      },
    }
  );
}
