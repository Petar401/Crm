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

export interface LeadWithRelations extends Lead {
  campaign: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  contact: { id: string; full_name: string } | null;
}

export async function getLead(
  workspaceId: string,
  id: string
): Promise<LeadWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "*, campaign:lead_campaigns(id, name), company:companies!leads_converted_company_id_fkey(id, name), contact:contacts!leads_converted_contact_id_fkey(id, full_name)"
    )
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  return (data as LeadWithRelations) ?? null;
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

  const now = new Date();
  const currentHour = now.getUTCHours();
  return ((data ?? []) as LeadCampaign[]).filter((c) => {
    // Only fire at the campaign's chosen hour (UTC). The cron runs hourly.
    if (currentHour !== (c.run_hour ?? 9)) return false;
    if (!c.last_run_at) return true;
    const elapsed = now.getTime() - new Date(c.last_run_at).getTime();
    const period =
      c.frequency === "weekly" ? 7 * 24 * 3600_000 : 24 * 3600_000;
    // Slack so the same hour can't trigger twice but a due run isn't skipped.
    return elapsed >= period - 90 * 60_000;
  });
}
