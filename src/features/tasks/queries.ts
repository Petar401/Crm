import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/db/types";

export interface TaskWithRelations extends Task {
  assignee: { id: string; full_name: string | null } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string } | null;
}

export async function getTasks(
  workspaceId: string
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), company:companies(id, name), deal:deals(id, name)"
    )
    .eq("workspace_id", workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });
  return (data ?? []) as TaskWithRelations[];
}
