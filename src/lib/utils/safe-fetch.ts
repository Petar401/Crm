import "server-only";

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

/**
 * Runs a callback with a URL vetted against SSRF: rejects non-http(s), resolves
 * the hostname, and blocks private, loopback, link-local, and CGNAT ranges so a
 * user-supplied URL (e.g. lead campaign enrichment fetching OSM website fields)
 * cannot be used to probe the internal network from the Vercel runtime.
 *
 * The address check runs inside the socket's own DNS lookup, so the address
 * that is vetted is the address that is connected to. (Resolving once to vet
 * and letting `fetch` resolve again left a DNS-rebinding gap: a hostile DNS
 * server could answer the check with a public IP and the connect with a
 * private one.) Redirects are never followed.
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

type Resolver = (
  hostname: string,
  callback: (err: Error | null, addresses: LookupAddress[]) => void
) => void;

const systemResolver: Resolver = (hostname, callback) =>
  dnsLookup(hostname, { all: true }, (err, addresses) =>
    callback(err, addresses ?? [])
  );

/**
 * Builds a `lookup` for http(s).request that refuses to hand the socket any
 * blocked address. Exported for tests (inject a resolver to simulate DNS).
 */
export function createGuardedLookup(
  resolve: Resolver = systemResolver
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, (err, addresses) => {
      const fail = (e: Error) =>
        (callback as (e: Error, a: string, f: number) => void)(e, "", 0);
      if (err) return fail(err);
      const usable = addresses.filter(
        (a) => !options.family || a.family === options.family
      );
      if (usable.length === 0) return fail(new Error("No address found"));
      if (usable.some((a) => isBlockedAddress(a.address))) {
        return fail(new Error("Blocked address"));
      }
      if (options.all) {
        (callback as (e: null, a: LookupAddress[]) => void)(null, usable);
      } else {
        callback(null, usable[0].address, usable[0].family);
      }
    });
  };
}

const guardedLookup = createGuardedLookup();

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

  // IP-literal hosts never reach the socket's DNS lookup, so vet them here.
  // (URL keeps IPv6 literals bracketed: "[::1]".)
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isBlockedAddress(host)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  try {
    return await new Promise<SafeFetchResult | null>((resolve) => {
      const client = url.protocol === "https:" ? https : http;
      const req = client.request(
        url,
        {
          method: "GET",
          lookup: guardedLookup,
          signal: controller.signal,
          headers: {
            "user-agent": options.userAgent ?? "CRM-LeadFinder/1.0",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            res.resume();
            return resolve(null);
          }
          if (status < 200 || status >= 300) {
            res.resume();
            return resolve({ status, text: "" });
          }

          const chunks: Buffer[] = [];
          let total = 0;
          const finish = () =>
            resolve({ status, text: Buffer.concat(chunks).toString("utf8") });
          res.on("data", (chunk: Buffer) => {
            total += chunk.byteLength;
            if (total > maxBytes) {
              res.destroy();
              return finish();
            }
            chunks.push(chunk);
          });
          res.on("end", finish);
          res.on("error", () => resolve(null));
        }
      );
      req.on("error", () => resolve(null));
      req.end();
    });
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
  if (lower.startsWith("fec0:")) return true; // deprecated site-local
  // IPv4-mapped IPv6: ::ffff:a.b.c.d — extract the trailing v4 and re-check.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  // Same, in hex form: ::ffff:7f00:1 is 127.0.0.1.
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isBlockedV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}
