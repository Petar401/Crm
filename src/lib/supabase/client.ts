import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client. Uses only public (NEXT_PUBLIC_*) credentials. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
