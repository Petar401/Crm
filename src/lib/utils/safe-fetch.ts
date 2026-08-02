import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Runs a callback with a URL vetted against SSRF: rejects non-http(s), resolves
 * the hostname, and blocks private, loopback, link-local, and CGNAT ranges so a
 * user-supplied URL (e.g. lead campaign enrichment fetching OSM website fields)
 * cannot be used to probe the internal network from the Vercel runtime.
 *
 * Returns null if the URL is unsafe or fetching fails; callers should treat
 * that the same as "no data".
 */
export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

export interface SafeFetchResult {
  status: number;
  text: string;
}

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_BYTES = 1_000_000;

export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname;
  const candidates: string[] = [];

  if (isIP(host)) {
    candidates.push(host);
  } else {
    try {
      const records = await lookup(host, { all: true });
      for (const r of records) candidates.push(r.address);
    } catch {
      return null;
    }
  }

  if (candidates.length === 0) return null;
  for (const address of candidates) {
    if (isBlockedAddress(address)) return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "user-agent": options.userAgent ?? "CRM-LeadFinder/1.0",
      },
    });

    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok || !res.body) return { status: res.status, text: "" };

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { status: res.status, text: buf.toString("utf8") };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns true for RFC 1918, loopback, link-local, unique-local (IPv6),
 * CGNAT, unspecified, and IPv4-mapped-IPv6 private addresses.
 */
function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip);
  return true;
}

function isBlockedV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6: ::ffff:a.b.c.d — extract the trailing v4 and re-check.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  return false;
}
