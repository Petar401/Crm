import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT, OPTIONS_LIMIT } from "@/lib/constants/list";
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
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
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

/**
 * Lightweight list of companies for select inputs. Bounded by OPTIONS_LIMIT;
 * pass a search term when the user has typed one so the combobox can page
 * to the matching subset instead of the full workspace.
 */
export async function getCompanyOptions(
  workspaceId: string,
  search?: string
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id, name")
    .eq("workspace_id", workspaceId);
  if (search && search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }
  const { data } = await query
    .order("name", { ascending: true })
    .limit(OPTIONS_LIMIT);
  return (data ?? []) as { id: string; name: string }[];
}
