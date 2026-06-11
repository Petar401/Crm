import { createClient } from "@/lib/supabase/server";
import type { Deal, DealStage, DealPipeline, Contact } from "@/lib/db/types";

export interface DealWithRelations extends Deal {
  company: { id: string; name: string } | null;
}

export async function getDeals(
  workspaceId: string
): Promise<DealWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, company:companies(id, name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DealWithRelations[];
}

export async function getDeal(
  workspaceId: string,
  id: string
): Promise<DealWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, company:companies(id, name)")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return (data as DealWithRelations) ?? null;
}

export async function getStages(workspaceId: string): Promise<DealStage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_stages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  return (data ?? []) as DealStage[];
}

export async function getPipelines(
  workspaceId: string
): Promise<DealPipeline[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_pipelines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DealPipeline[];
}

export async function getContactsForCompany(
  workspaceId: string,
  companyId: string
): Promise<Pick<Contact, "id" | "full_name">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId);
  return (data ?? []) as Pick<Contact, "id" | "full_name">[];
}

export interface ContactOption {
  id: string;
  full_name: string;
  company_id: string;
}

/** All contacts (lite) for select inputs, used to pick a deal's primary contact. */
export async function getContactOptions(
  workspaceId: string
): Promise<ContactOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, full_name, company_id")
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true });
  return (data ?? []) as ContactOption[];
}
