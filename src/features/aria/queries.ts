import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CRM snapshot bundled into Aria's system prompt on every chat turn.
 *
 * Previously this ran 7 unbounded workspace queries per assistant message,
 * so a 3-turn conversation on a modest workspace fired ~21 Supabase calls
 * before the model even started. The snapshot doesn't change turn-to-turn,
 * so we wrap it in `unstable_cache` keyed by workspace_id with a 30 s TTL:
 * subsequent turns in the same chat reuse a hot copy, and a mutating action
 * (or the next natural cache turnover) refreshes it.
 *
 * The cached reads use the service-role admin client — `unstable_cache` runs
 * outside the request scope, so it can't consult cookies. The caller has
 * already established the workspace_id via requireAuthContext / MCP token
 * resolution, so bypassing RLS here does not widen access; it just hoists
 * the cache above the auth boundary.
 */
const CACHE_TTL_S = 30;

async function loadCrmContext(workspaceId: string): Promise<string> {
  const supabase = createAdminClient();

  const [companies, contacts, deals, tasks, activities, notes, leads] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id,name,status,industry,city,country,website")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("contacts")
        .select("id,first_name,last_name,email,job_title,company_id")
        .eq("workspace_id", workspaceId)
        .limit(200),
      supabase
        .from("deals")
        .select(
          "id,name,value,currency,status,stage_id,company_id,probability,expected_close_date"
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("tasks")
        .select("id,title,status,priority,due_at,assigned_to")
        .eq("workspace_id", workspaceId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("activities")
        .select("type,title,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("notebook_notes")
        .select("title,body")
        .eq("workspace_id", workspaceId)
        .limit(50),
      supabase
        .from("leads")
        .select(
          "id,company_name,website,industry,city,country,contact_name,job_title,match_score,match_reason"
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("match_score", { ascending: false, nullsFirst: false })
        .limit(50),
    ]);

  return JSON.stringify({
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    deals: deals.data ?? [],
    tasks: tasks.data ?? [],
    recentActivities: activities.data ?? [],
    notebookNotes: notes.data ?? [],
    leads: leads.data ?? [],
  });
}

export async function getCrmContext(workspaceId: string): Promise<string> {
  return unstable_cache(
    () => loadCrmContext(workspaceId),
    ["aria-crm-context", workspaceId],
    { revalidate: CACHE_TTL_S, tags: [`crm-context:${workspaceId}`] }
  )();
}
