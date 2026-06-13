import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/lib/db/types";

interface EntityRef {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  leadId?: string;
}

/** Activities related to a specific entity, newest first. */
export async function getEntityActivities(
  workspaceId: string,
  ref: EntityRef
): Promise<Activity[]> {
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (ref.companyId) query = query.eq("company_id", ref.companyId);
  if (ref.contactId) query = query.eq("contact_id", ref.contactId);
  if (ref.dealId) query = query.eq("deal_id", ref.dealId);
  if (ref.leadId) query = query.eq("lead_id", ref.leadId);

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Activity[];
}
