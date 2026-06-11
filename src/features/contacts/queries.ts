import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/db/types";

export interface ContactWithCompany extends Contact {
  company: { id: string; name: string } | null;
}

export async function getContacts(
  workspaceId: string
): Promise<ContactWithCompany[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ContactWithCompany[];
}

export async function getContact(
  workspaceId: string,
  id: string
): Promise<ContactWithCompany | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return (data as ContactWithCompany) ?? null;
}

/** Lightweight list of companies for select inputs. */
export async function getCompanyOptions(
  workspaceId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string }[];
}
