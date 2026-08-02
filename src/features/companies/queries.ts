import { createClient } from "@/lib/supabase/server";
import type { Company, Contact, Deal } from "@/lib/db/types";

export interface CompanyListItem extends Company {
  contactCount: number;
  openDealsValue: number;
}

/**
 * Reads from the `companies_with_stats` view (migration 0018), which
 * pre-aggregates the contact count and open-deals value per company. This
 * replaces the previous PostgREST embedded-relation query, which pulled every
 * deal in the workspace on every list render and aggregated in JS.
 */
export async function getCompanies(
  workspaceId: string
): Promise<CompanyListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies_with_stats")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const {
      contact_count,
      open_deals_value,
      ...company
    } = row as Company & {
      contact_count: number;
      open_deals_value: number | string | null;
    };
    return {
      ...company,
      contactCount: contact_count ?? 0,
      openDealsValue: Number(open_deals_value ?? 0),
    } as CompanyListItem;
  });
}

export async function getCompany(
  workspaceId: string,
  id: string
): Promise<Company | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<Company>();
  return data;
}

export async function getCompanyContacts(
  workspaceId: string,
  companyId: string
): Promise<Contact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false });
  return (data ?? []) as Contact[];
}

export async function getCompanyDeals(
  workspaceId: string,
  companyId: string
): Promise<Deal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Deal[];
}
