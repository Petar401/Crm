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
    public readonly kind: "unauthorized" | "credits" | "unknown"
  ) {
    super(message);
    this.name = "ApolloApiError";
  }
}

function classify(status: number): ApolloApiError["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 402 || status === 403 || status === 429) return "credits";
  return "unknown";
}

async function apolloRequest<T>(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; searchParams?: Record<string, string> }
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
  });

  if (!res.ok) {
    let message = `Apollo request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApolloApiError(message, res.status, classify(res.status));
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
  qOrganizationName?: string;
  qOrganizationDomains?: string[];
  organizationLocations?: string[];
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
      q_organization_name: params.qOrganizationName || undefined,
      q_organization_domains: params.qOrganizationDomains,
      organization_locations: params.organizationLocations,
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
        reveal_personal_emails: false,
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
