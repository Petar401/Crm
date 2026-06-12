/**
 * Free lead source: OpenStreetMap via the Overpass + Nominatim APIs.
 *
 * No API key, no signup, and OSM data is redistributable under the ODbL. We
 * geocode the campaign's location to a bounding box (Nominatim), then query
 * Overpass for named businesses whose category tags or name match the
 * campaign's target categories. Both services ask for a descriptive
 * User-Agent and fair-use rate limits — we cap results and run at most hourly.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "CRM-LeadFinder/1.0 (self-hosted CRM lead automation)";

// OSM keys whose values typically describe a business "category".
const CATEGORY_KEYS = [
  "amenity",
  "shop",
  "office",
  "craft",
  "healthcare",
  "leisure",
  "tourism",
  "club",
];

export interface OverpassBusiness {
  osmId: string; // e.g. "node/123456"
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

/** Escape a user-supplied string for safe use inside an Overpass regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Geocode a free-text location to an Overpass bbox "south,west,north,east". */
export async function geocodeArea(
  location: string,
  country?: string | null
): Promise<string | null> {
  const params = new URLSearchParams({
    q: country ? `${location}, ${country}` : location,
    format: "json",
    limit: "1",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ boundingbox?: string[] }>;
  const box = data[0]?.boundingbox;
  if (!box || box.length !== 4) return null;

  // Nominatim returns [south, north, west, east]; Overpass wants S,W,N,E.
  const [south, north, west, east] = box;
  return `${south},${west},${north},${east}`;
}

/** Build an Overpass QL query for the given categories within a bbox. */
function buildQuery(categories: string[], bbox: string, limit: number): string {
  const regex = categories.map((c) => escapeRegex(c.trim())).join("|");
  const statements = CATEGORY_KEYS.map(
    (key) => `  nwr["name"]["${key}"~"${regex}",i](${bbox});`
  );
  // Also catch businesses whose name matches a category but are tagged oddly.
  statements.push(`  nwr["name"~"${regex}",i]["website"](${bbox});`);

  return `[out:json][timeout:25];
(
${statements.join("\n")}
);
out center tags ${limit};`;
}

function firstTag(
  tags: Record<string, string>,
  keys: string[]
): string | null {
  for (const key of keys) {
    if (tags[key]) return tags[key];
  }
  return null;
}

function pickCategory(tags: Record<string, string>): string | null {
  for (const key of CATEGORY_KEYS) {
    if (tags[key]) return tags[key].replace(/_/g, " ");
  }
  return null;
}

/** Discover businesses for a campaign. Returns up to `limit` normalised rows. */
export async function searchBusinesses(opts: {
  categories: string[];
  location: string;
  country?: string | null;
  limit: number;
}): Promise<OverpassBusiness[]> {
  const categories = opts.categories.map((c) => c.trim()).filter(Boolean);
  if (categories.length === 0) return [];

  const bbox = await geocodeArea(opts.location, opts.country);
  if (!bbox) return [];

  const query = buildQuery(categories, bbox, Math.min(opts.limit * 3, 150));
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass request failed (${res.status})`);
  }

  const json = (await res.json()) as { elements?: OverpassElement[] };
  const seen = new Set<string>();
  const results: OverpassBusiness[] = [];

  for (const el of json.elements ?? []) {
    const tags = el.tags;
    if (!tags?.name) continue;

    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);

    const housenumber = tags["addr:housenumber"];
    const streetName = tags["addr:street"];
    const street = [housenumber, streetName].filter(Boolean).join(" ") || null;

    results.push({
      osmId,
      name: tags.name,
      website: firstTag(tags, ["website", "contact:website", "url"]),
      phone: firstTag(tags, ["phone", "contact:phone", "contact:mobile"]),
      email: firstTag(tags, ["email", "contact:email"]),
      street,
      city: firstTag(tags, ["addr:city", "addr:town", "addr:village"]),
      country: tags["addr:country"] ?? null,
      category: pickCategory(tags),
    });

    if (results.length >= opts.limit) break;
  }

  return results;
}
