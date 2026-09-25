/**
 * UK postcode helpers. Pure and safe on client and server.
 *
 * The pattern covers every current UK format (A9 9AA, A99 9AA, A9A 9AA,
 * AA9 9AA, AA99 9AA, AA9A 9AA) plus the special GIR 0AA. It is a shape check
 * only — postcodes.io is the source of truth for whether one actually exists.
 */
const UK_POSTCODE = /^(GIR ?0AA|[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})$/;

/** "cb21an" / " CB2  1AN " → "CB2 1AN". Returns null when it isn't UK-shaped. */
export function normalizeUkPostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5 || compact.length > 7) return null;
  const formatted = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return UK_POSTCODE.test(formatted) ? formatted : null;
}

export function isValidUkPostcode(input: string | null | undefined): boolean {
  return normalizeUkPostcode(input) !== null;
}

export interface PostcodePlace {
  district: string | null;
  county: string | null;
}

export interface AddressFields {
  city?: string | null;
  county?: string | null;
  country?: string | null;
}

/**
 * Which address fields a postcode look-up should fill in: only the empty ones,
 * so a town the user typed ("Aylsham") is never replaced by the council
 * district postcodes.io reports ("Broadland"). The county falls back to the
 * district for unitary authorities (e.g. Peterborough), never to the nation.
 */
export function addressFillFromPostcode(
  place: PostcodePlace,
  current: AddressFields
): { city?: string; county?: string; country?: string } {
  const empty = (v: string | null | undefined) => !v || !v.trim();
  const fill: { city?: string; county?: string; country?: string } = {};
  if (empty(current.city) && place.district) fill.city = place.district;
  const county = place.county ?? place.district;
  if ("county" in current && empty(current.county) && county) fill.county = county;
  if (empty(current.country)) fill.country = "United Kingdom";
  return fill;
}
