import "server-only";

import { normalizeUkPostcode } from "@/lib/utils/postcode";

/**
 * UK postcode lookup via postcodes.io — free, open data (ONS/OS), no API key
 * or signup. Results are cached by Next's fetch cache for a day: postcode
 * geography changes only a few times a year.
 */
const BASE_URL = "https://api.postcodes.io";
const TIMEOUT_MS = 5000;
const REVALIDATE_S = 60 * 60 * 24;
/** postcodes.io accepts at most 100 postcodes per bulk request. */
export const BULK_LIMIT = 100;

export interface PostcodeInfo {
  postcode: string;
  /** Local authority district, e.g. "Cambridge" or "South Norfolk". */
  district: string | null;
  /** Shire county when there is one (null for unitary authorities). */
  county: string | null;
  /** English region, e.g. "East of England" (null outside England). */
  region: string | null;
  /** "England", "Scotland", "Wales" or "Northern Ireland". */
  nation: string | null;
  ward: string | null;
  constituency: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface RawPostcode {
  postcode: string;
  admin_district: string | null;
  admin_county: string | null;
  region: string | null;
  country: string | null;
  admin_ward: string | null;
  parliamentary_constituency: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function toPostcodeInfo(raw: RawPostcode): PostcodeInfo {
  return {
    postcode: raw.postcode,
    district: raw.admin_district ?? null,
    county: raw.admin_county ?? null,
    region: raw.region ?? null,
    nation: raw.country ?? null,
    ward: raw.admin_ward ?? null,
    constituency: raw.parliamentary_constituency ?? null,
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
  };
}

export type PostcodeLookup =
  | { status: "ok"; info: PostcodeInfo }
  | { status: "invalid" | "not_found" | "unavailable" };

/** Looks up one postcode. Never throws. */
export async function lookupPostcode(input: string): Promise<PostcodeLookup> {
  const postcode = normalizeUkPostcode(input);
  if (!postcode) return { status: "invalid" };
  try {
    const res = await fetch(
      `${BASE_URL}/postcodes/${encodeURIComponent(postcode)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_S },
      }
    );
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable" };
    const body = (await res.json()) as { result?: RawPostcode | null };
    return body.result
      ? { status: "ok", info: toPostcodeInfo(body.result) }
      : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Looks up many postcodes (deduplicated, batched by 100). Returns a map keyed
 * by the normalised postcode; invalid or unknown postcodes are simply absent.
 * Never throws — a failed batch just contributes no entries.
 */
export async function bulkLookupPostcodes(
  inputs: readonly (string | null | undefined)[]
): Promise<Map<string, PostcodeInfo>> {
  const unique = Array.from(
    new Set(inputs.map((p) => normalizeUkPostcode(p)).filter((p): p is string => !!p))
  );
  const found = new Map<string, PostcodeInfo>();

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += BULK_LIMIT) {
    batches.push(unique.slice(i, i + BULK_LIMIT));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch(`${BASE_URL}/postcodes`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ postcodes: batch }),
          signal: AbortSignal.timeout(TIMEOUT_MS * 2),
          next: { revalidate: REVALIDATE_S },
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          result?: { query: string; result: RawPostcode | null }[];
        };
        for (const item of body.result ?? []) {
          if (!item.result) continue;
          const key = normalizeUkPostcode(item.query);
          if (key) found.set(key, toPostcodeInfo(item.result));
        }
      } catch {
        // Network/timeout: leave this batch unresolved.
      }
    })
  );

  return found;
}
