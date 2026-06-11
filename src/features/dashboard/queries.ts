import { createClient } from "@/lib/supabase/server";
import type { Activity, Deal, DealStage, Task } from "@/lib/db/types";

export interface DashboardData {
  openDeals: number;
  pipelineValue: number;
  tasksDueToday: number;
  newLeadsThisWeek: number;
  dealsByStage: { stage: DealStage; count: number; value: number }[];
  upcomingTasks: Task[];
  recentActivity: Activity[];
}

export async function getDashboardData(
  workspaceId: string
): Promise<DashboardData> {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    { data: openDeals },
    { data: stages },
    { data: tasksDue },
    { data: newLeads },
    { data: upcomingTasks },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("id, value, stage_id, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "open"),
    supabase
      .from("deal_stages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("id")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .gte("due_at", startOfToday.toISOString())
      .lte("due_at", endOfToday.toISOString()),
    supabase
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "lead")
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("activities")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const deals = (openDeals ?? []) as Pick<
    Deal,
    "id" | "value" | "stage_id" | "status"
  >[];
  const stageList = (stages ?? []) as DealStage[];

  const pipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const dealsByStage = stageList.map((stage) => {
    const inStage = deals.filter((d) => d.stage_id === stage.id);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
    };
  });

  return {
    openDeals: deals.length,
    pipelineValue,
    tasksDueToday: (tasksDue ?? []).length,
    newLeadsThisWeek: (newLeads ?? []).length,
    dealsByStage,
    upcomingTasks: (upcomingTasks ?? []) as Task[],
    recentActivity: (recentActivity ?? []) as Activity[],
  };
}
