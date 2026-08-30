import "server-only";

import type { ApolloPerson } from "@/features/apollo/client";

/** Baseline for an Apollo result before any completeness signals are added. */
export const APOLLO_BASE_SCORE = 40;

export interface ApolloScoreFilters {
  organizationDomains?: string[];
  locations?: string[];
  personSeniorities?: string[];
}

const SENIORITY_TITLE_HINTS: Record<string, RegExp> = {
  owner: /\bowner\b/i,
  founder: /\bfounder\b/i,
  c_suite: /\b(ceo|cfo|coo|cto|cmo|chief)\b/i,
  partner: /\bpartner\b/i,
  vp: /\b(vp|vice president)\b/i,
  head: /\bhead of\b/i,
  director: /\bdirector\b/i,
  manager: /\bmanager\b/i,
};

/**
 * Completeness-based heuristic score (0-100), no AI call — fast enough to
 * run synchronously over a full page of search results. Reused by both the
 * ad-hoc search preview/import path (search-actions.ts) and, as the baseline
 * under the AI blend, the campaign runner (campaign-run.ts), so both paths
 * produce comparable scores.
 */
export function scoreApolloPerson(
  person: ApolloPerson,
  filters: ApolloScoreFilters = {}
): { score: number; reason: string } {
  let score = APOLLO_BASE_SCORE;
  const reasons: string[] = [];

  if (person.email) {
    if (person.email_status === "verified") {
      score += 20;
      reasons.push("verified email");
    } else if (person.email_status === "guessed" || person.email_status === "extrapolated") {
      score += 10;
      reasons.push("likely email");
    } else {
      score += 5;
    }
  }
  if (person.phone_numbers?.[0]?.raw_number) {
    score += 10;
    reasons.push("phone on file");
  }
  if (person.title) {
    score += 10;
    reasons.push("title known");
  }

  if (filters.organizationDomains?.length && person.organization?.website_url) {
    score += 10;
    reasons.push("company match");
  }
  if (filters.locations?.length && (person.organization?.city || person.city)) {
    score += 10;
    reasons.push("location match");
  }
  if (filters.personSeniorities?.length && person.title) {
    const matched = filters.personSeniorities.some((s) =>
      SENIORITY_TITLE_HINTS[s]?.test(person.title ?? "")
    );
    if (matched) {
      score += 10;
      reasons.push("seniority match");
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.length ? reasons.join(", ") : "limited profile data",
  };
}
