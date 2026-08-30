import "server-only";

/**
 * Apollo.io REST client. Apollo's endpoint is fixed and trusted (unlike a
 * user-supplied website URL), so this uses plain `fetch` the same way
 * src/features/leads/overpass.ts talks to Overpass/Nominatim — not the
 * SSRF-hardened safeFetchText in src/lib/utils/safe-fetch.ts, which exists
 * specifically to guard against server-side requests to attacker-controlled
 * URLs.
 */

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

export class ApolloApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: "unauthorized" | "credits" | "rate_limited" | "unknown"
  ) {
    super(message);
    this.name = "ApolloApiError";
  }
}

function classify(status: number): ApolloApiError["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 402 || status === 403) return "credits";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function apolloRequest<T>(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; searchParams?: Record<string, string> },
  attempt = 0
): Promise<T> {
  const url = new URL(`${APOLLO_BASE_URL}${path}`);
  if (init.searchParams) {
    for (const [key, value] of Object.entries(init.searchParams)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // Fail fast rather than risk a single stalled request eating a bulk
    // campaign run's whole execution budget.
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    let message = `Apollo request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    const kind = classify(res.status);
    // A true rate limit is often transient — retry once after a short delay
    // before giving up, rather than immediately surfacing it as a failure.
    if (kind === "rate_limited" && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return apolloRequest<T>(apiKey, path, init, attempt + 1);
    }
    throw new ApolloApiError(message, res.status, kind);
  }

  return (await res.json()) as T;
}

export interface ApolloOrganization {
  id: string;
  name: string | null;
  website_url: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  // Fields returned by Organization Enrichment (/organizations/enrich) —
  // used to fill in a real company address, since Apollo's people search
  // never returns a street address for the person themselves.
  raw_address: string | null;
  street_address: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  estimated_num_employees: number | null;
  founded_year: number | null;
  keywords: string[] | null;
}

export interface ApolloPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  phone_numbers?: { raw_number: string | null }[];
  organization: ApolloOrganization | null;
  city: string | null;
  country: string | null;
}

export interface ApolloPeopleSearchParams {
  personTitles?: string[];
  personSeniorities?: string[];
  qOrganizationName?: string;
  qOrganizationDomains?: string[];
  organizationLocations?: string[];
  qKeywords?: string;
  organizationNumEmployeesRanges?: string[];
  perPage: number;
  page?: number;
}

/**
 * Apollo deprecated `/mixed_people/search` for API callers in favor of
 * `/mixed_people/api_search` — same request/response shape, different path.
 */
export async function searchPeople(
  apiKey: string,
  params: ApolloPeopleSearchParams
): Promise<{ people: ApolloPerson[]; totalEntries: number }> {
  const data = await apolloRequest<{
    people?: ApolloPerson[];
    pagination?: { total_entries?: number };
  }>(apiKey, "/mixed_people/api_search", {
    method: "POST",
    body: {
      person_titles: params.personTitles,
      person_seniorities: params.personSeniorities,
      q_organization_name: params.qOrganizationName || undefined,
      q_organization_domains: params.qOrganizationDomains,
      organization_locations: params.organizationLocations,
      q_keywords: params.qKeywords || undefined,
      organization_num_employees_ranges: params.organizationNumEmployeesRanges,
      per_page: params.perPage,
      page: params.page ?? 1,
    },
  });
  return {
    people: data.people ?? [],
    totalEntries: data.pagination?.total_entries ?? 0,
  };
}

export interface ApolloPersonMatchParams {
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  domain?: string;
}

/** People Enrichment ("match") — credit-metered per successful match. */
export async function enrichPerson(
  apiKey: string,
  params: ApolloPersonMatchParams
): Promise<ApolloPerson | null> {
  const data = await apolloRequest<{ person?: ApolloPerson }>(
    apiKey,
    "/people/match",
    {
      method: "POST",
      body: {
        email: params.email || undefined,
        first_name: params.firstName || undefined,
        last_name: params.lastName || undefined,
        organization_name: params.organizationName || undefined,
        domain: params.domain || undefined,
        reveal_personal_emails: true,
      },
    }
  );
  return data.person ?? null;
}

/** Organization Enrichment by domain — used to fill in company-level fields. */
export async function enrichOrganization(
  apiKey: string,
  domain: string
): Promise<ApolloOrganization | null> {
  const data = await apolloRequest<{ organization?: ApolloOrganization }>(
    apiKey,
    "/organizations/enrich",
    { method: "GET", searchParams: { domain } }
  );
  return data.organization ?? null;
}
