import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/db/types";

export interface EntityRef {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  leadId?: string;
}

export async function getNotes(
  workspaceId: string,
  ref: EntityRef
): Promise<Note[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (ref.companyId) query = query.eq("company_id", ref.companyId);
  if (ref.contactId) query = query.eq("contact_id", ref.contactId);
  if (ref.dealId) query = query.eq("deal_id", ref.dealId);
  if (ref.leadId) query = query.eq("lead_id", ref.leadId);

  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []) as Note[];
}
