/**
 * Restricts a post-login (or callback) `next` param to a same-origin internal
 * path. Rejects absolute URLs, protocol-relative (`//host`) and backslash
 * tricks so `next` can never be turned into an open redirect.
 */
export function safeInternalPath(
  next: string | undefined | null,
  fallback = "/"
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/\\") || next.includes("\\")) return fallback;
  return next;
}
