import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Client authentication for the token endpoint (RFC 6749 §2.3.1).
 *
 * Public clients (token_endpoint_auth_method "none", e.g. Claude's connector)
 * have no stored secret and authenticate with PKCE alone. A client that
 * registered as confidential was handed a secret at registration — it must
 * present it, or the secret provides no protection at all.
 */
export function verifyClientSecret(
  presented: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!storedHash) return true;
  if (!presented) return false;
  const a = Buffer.from(createHash("sha256").update(presented).digest("hex"));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Parses `Authorization: Basic base64(urlencode(id):urlencode(secret))`. */
export function parseBasicClientAuth(
  header: string | null | undefined
): { clientId: string; clientSecret: string } | null {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/=]+)\s*$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  try {
    return {
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  } catch {
    return null;
  }
}
