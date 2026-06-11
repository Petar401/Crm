import { createClient } from "@/lib/supabase/server";
import type { Company, Contact, Deal } from "@/lib/db/types";

export async function getCompanies(workspaceId: string): Promise<Company[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Company[];
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
