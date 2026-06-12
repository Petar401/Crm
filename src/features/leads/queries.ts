import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead, LeadCampaign, LeadStatus } from "@/lib/db/types";

export async function getCampaigns(
  workspaceId: string
): Promise<LeadCampaign[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_campaigns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as LeadCampaign[];
}

export async function getCampaign(
  workspaceId: string,
  id: string
): Promise<LeadCampaign | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_campaigns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<LeadCampaign>();
  return data;
}

export async function getLeads(
  workspaceId: string,
  status?: LeadStatus
): Promise<Lead[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (status) query = query.eq("status", status);
  const { data } = await query
    .order("match_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Lead[];
}

/**
 * Service-role read for the cron route: all enabled, scheduled campaigns whose
 * cadence has elapsed since the last run. Bypasses RLS (no user session).
 */
export async function getDueCampaigns(): Promise<LeadCampaign[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lead_campaigns")
    .select("*")
    .eq("enabled", true)
    .in("frequency", ["daily", "weekly"]);

  const now = Date.now();
  return ((data ?? []) as LeadCampaign[]).filter((c) => {
    if (!c.last_run_at) return true;
    const elapsed = now - new Date(c.last_run_at).getTime();
    const period =
      c.frequency === "weekly" ? 7 * 24 * 3600_000 : 24 * 3600_000;
    // Small slack so an hourly cron doesn't skip a due run sitting just under.
    return elapsed >= period - 30 * 60_000;
  });
}
