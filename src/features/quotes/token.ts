import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Prefix on the plaintext so a leaked token is obvious in logs. */
export const QUOTE_SHARE_PREFIX = "crm_qs_";

export function mintShareToken(): { plaintext: string; hash: string } {
  const plaintext = `${QUOTE_SHARE_PREFIX}${randomBytes(32).toString("hex")}`;
  return { plaintext, hash: sha256Hex(plaintext) };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
