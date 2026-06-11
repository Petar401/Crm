/**
 * Absolute base URL of the app, used to build auth redirect links (e.g. the
 * password-reset callback). Set `NEXT_PUBLIC_SITE_URL` to the deployed origin in
 * hosting/Vercel and in `.env.local`; falls back to localhost for local dev.
 *
 * Whatever this resolves to must also be allow-listed in Supabase under
 * Authentication → URL Configuration → Redirect URLs.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
