import { createClient } from "@/lib/supabase/server";

export async function getCrmContext(workspaceId: string): Promise<string> {
  const supabase = await createClient();

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
