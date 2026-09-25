import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { bulkLookupPostcodes } from "@/features/tools/postcodes";
import { normalizeUkPostcode } from "@/lib/utils/postcode";
import { RecordsMapLoader } from "@/features/tools/components/records-map-loader";
import type { MapPoint } from "@/features/tools/components/records-map";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;
const PAGE_SIZE = 1000;

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads up to MAX_ROWS rows with a postcode, page by page — a single
 * `.limit(2000)` is silently capped by PostgREST's max-rows (1000 on
 * Supabase). Throws on a query error so the page can say so.
 */
async function loadWithPostcodes<T>(
  supabase: Client,
  table: "companies" | "leads",
  columns: string,
  postcodeColumn: "postcode" | "postal_code",
  workspaceId: string
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; ) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("workspace_id", workspaceId)
      .not(postcodeColumn, "is", null)
      .order("id", { ascending: true })
      .range(from, Math.min(from + PAGE_SIZE, MAX_ROWS) - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    if (page.length === 0) break;
    rows.push(...page);
    from += page.length;
  }
  return rows;
}

interface CompanyRow {
  id: string;
  name: string;
  postcode: string | null;
  city: string | null;
  status: string;
}

interface LeadRow {
  id: string;
  company_name: string;
  postal_code: string | null;
  city: string | null;
  status: string;
}

export default async function MapPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  const canViewCompanies = allowed.has("companies.view");
  const canViewLeads = allowed.has("leads.view");
  if (!canViewCompanies && !canViewLeads) redirect("/");

  const supabase = await createClient();

  let loadError: string | null = null;
  const [companies, leads] = await Promise.all([
    canViewCompanies
      ? loadWithPostcodes<CompanyRow>(
          supabase,
          "companies",
          "id, name, postcode, city, status",
          "postcode",
          ctx.workspace.id
        ).catch((e: Error) => {
          loadError = e.message;
          return [] as CompanyRow[];
        })
      : ([] as CompanyRow[]),
    canViewLeads
      ? loadWithPostcodes<LeadRow>(
          supabase,
          "leads",
          "id, company_name, postal_code, city, status",
          "postal_code",
          ctx.workspace.id
        ).catch((e: Error) => {
          loadError = e.message;
          return [] as LeadRow[];
        })
      : ([] as LeadRow[]),
  ]);

  const postcodes = await bulkLookupPostcodes([
    ...companies.map((c) => c.postcode),
    ...leads.map((l) => l.postal_code),
  ]);

  const points: MapPoint[] = [];
  let notPlaced = 0;

  for (const c of companies) {
    const key = normalizeUkPostcode(c.postcode);
    const info = key ? postcodes.get(key) : undefined;
    if (!info || info.latitude == null || info.longitude == null) {
      notPlaced++;
      continue;
    }
    points.push({
      id: c.id,
      kind: "company",
      name: c.name,
      href: `/companies/${c.id}`,
      lat: info.latitude,
      lng: info.longitude,
      status: c.status,
      postcode: c.postcode ?? "",
    });
  }

  for (const l of leads) {
    const key = normalizeUkPostcode(l.postal_code);
    const info = key ? postcodes.get(key) : undefined;
    if (!info || info.latitude == null || info.longitude == null) {
      notPlaced++;
      continue;
    }
    points.push({
      id: l.id,
      kind: "lead",
      name: l.company_name,
      href: `/leads/${l.id}`,
      lat: info.latitude,
      lng: info.longitude,
      status: l.status,
      postcode: l.postal_code ?? "",
    });
  }

  return (
    <div>
      <PageHeader
        title="Map"
        description="Companies and leads plotted by UK postcode"
      />
      {loadError && (
        <p className="text-destructive mb-3 text-sm">
          Some records couldn&apos;t be loaded ({loadError}). The map may be incomplete.
        </p>
      )}
      {(companies.length >= MAX_ROWS || leads.length >= MAX_ROWS) && (
        <p className="text-muted-foreground mb-3 text-sm">
          Showing the first {MAX_ROWS.toLocaleString("en-GB")} records of each type.
        </p>
      )}
      <RecordsMapLoader points={points} notPlacedCount={notPlaced} />
    </div>
  );
}
