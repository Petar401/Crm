import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT, OPTIONS_LIMIT } from "@/lib/constants/list";
import type { Email } from "@/lib/db/types";

/** Messages sent from the CRM, newest first (durable send log). */
export async function getSentEmails(workspaceId: string): Promise<Email[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emails")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  return (data ?? []) as Email[];
}

export interface ContactEmailOption {
  id: string;
  name: string;
  email: string;
}

/**
 * Contacts that have an email address, for the compose "link & prefill" picker.
 * Bounded by OPTIONS_LIMIT; pass a search term to narrow by name.
 */
export async function getContactEmailOptions(
  workspaceId: string,
  search?: string
): Promise<ContactEmailOption[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("workspace_id", workspaceId)
    .not("email", "is", null);
  if (search && search.trim()) {
    query = query.ilike("full_name", `%${search.trim()}%`);
  }
  const { data } = await query
    .order("full_name", { ascending: true })
    .limit(OPTIONS_LIMIT);
  return (data ?? [])
    .filter((c): c is { id: string; full_name: string; email: string } =>
      Boolean(c.email)
    )
    .map((c) => ({ id: c.id, name: c.full_name, email: c.email }));
}
