import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/** base64url(SHA-256(input)) — the S256 PKCE transform (RFC 7636 §4.2). */
export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Verifies a PKCE `code_verifier` against the stored `code_challenge`. Only the
 * S256 method is supported (plain is rejected by the caller). Uses a
 * constant-time comparison to avoid leaking the challenge byte-by-byte.
 */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: string
): boolean {
  if (method !== "S256") return false;
  const computed = s256Challenge(verifier);
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
