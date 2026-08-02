import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Session-bound CSRF token for the OAuth consent form.
 *
 * A random cookie isn't practical here because Server Components can't set
 * cookies during render, so we mint a stateless HMAC token instead:
 *
 *   token = `${expiresAtMs}.${hmac_sha256(secret, `${userId}.${expiresAtMs}`)}`
 *
 * Verifying the token requires the same signed-in user, which is exactly the
 * property we need: an attacker who tricks the victim into POSTing to
 * /api/oauth/authorize cannot forge a token because they don't know the
 * server-side secret, and a token minted for a different user won't verify
 * for the currently signed-in one.
 */

const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.AUTH_CSRF_SECRET;
  if (!s) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or AUTH_CSRF_SECRET) is required to sign OAuth CSRF tokens"
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function mintOAuthCsrfToken(userId: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const sig = sign(`${userId}.${expiresAt}`);
  return `${expiresAt}.${sig}`;
}

export function verifyOAuthCsrfToken(
  token: string | undefined,
  userId: string
): boolean {
  if (!token) return false;
  const [expiresAtStr, sig] = token.split(".");
  if (!expiresAtStr || !sig) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = sign(`${userId}.${expiresAt}`);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
