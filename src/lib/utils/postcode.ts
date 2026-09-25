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
