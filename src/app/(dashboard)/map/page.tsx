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

  const [companiesResult, leadsResult] = await Promise.all([
    canViewCompanies
      ? supabase
          .from("companies")
          .select("id, name, postcode, city, status")
          .eq("workspace_id", ctx.workspace.id)
          .not("postcode", "is", null)
          .limit(MAX_ROWS)
      : Promise.resolve({ data: [] as CompanyRow[] | null }),
    canViewLeads
      ? supabase
          .from("leads")
          .select("id, company_name, postal_code, city, status")
          .eq("workspace_id", ctx.workspace.id)
          .not("postal_code", "is", null)
          .limit(MAX_ROWS)
      : Promise.resolve({ data: [] as LeadRow[] | null }),
  ]);

  const companies = (companiesResult.data ?? []) as CompanyRow[];
  const leads = (leadsResult.data ?? []) as LeadRow[];

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
      <RecordsMapLoader points={points} notPlacedCount={notPlaced} />
    </div>
  );
}
