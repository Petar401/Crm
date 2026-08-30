/**
 * Reads Apollo's email_status back out of a lead's `raw` jsonb column,
 * whose shape differs by the path that wrote it: search-import stores the
 * bare Apollo person, the campaign runner stores { search, enrichment }, and
 * the single-lead enrich button stores { ...raw, apollo_enrichment }.
 */
export function getApolloEmailStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const candidates = [r.apollo_enrichment, r.enrichment, r.search, r];
  for (const c of candidates) {
    if (
      c &&
      typeof c === "object" &&
      typeof (c as Record<string, unknown>).email_status === "string"
    ) {
      return (c as Record<string, unknown>).email_status as string;
    }
  }
  return null;
}
