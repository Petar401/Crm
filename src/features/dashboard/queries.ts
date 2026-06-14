import { createClient } from "@/lib/supabase/server";
import type { Activity, Deal, DealStage, Task } from "@/lib/db/types";

/** A task with a precomputed overdue flag (due before the start of today). */
export type UpcomingTask = Task & { overdue: boolean };

export interface DashboardData {
  // Pipeline (open deals)
  openDeals: number;
  pipelineValue: number;
  weightedPipeline: number;
  dealsByStage: { stage: DealStage; count: number; value: number }[];
  // Won / conversion
  wonThisMonthValue: number;
  wonThisMonthCount: number;
  wonValueDeltaPct: number | null;
  wonCount: number;
  lostCount: number;
  winRate: number; // 0..1
  // Tasks
  tasksDueToday: number;
  overdueTasks: number;
  upcomingTasks: UpcomingTask[];
  // Leads
  newLeadsThisWeek: number;
  newLeadsLastWeek: number;
  leadsDeltaPct: number | null;
  // Activity
  recentActivity: Activity[];
}

/** Percentage change vs a baseline; null when there is no baseline to compare. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardData(
  workspaceId: string
): Promise<DashboardData> {
  const supabase = await createClient();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  // Calendar-month boundaries for the won-revenue trend.
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    { data: openDealsData },
    { data: stages },
    { data: closedDealsData },
    { count: dueTodayCount },
    { count: overdueCount },
    { data: upcomingTasks },
    { data: leadCompanyRows },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("id, value, stage_id, probability")
      .eq("workspace_id", workspaceId)
      .eq("status", "open"),
    supabase
      .from("deal_stages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    // Won/lost deals power win-rate and the won-this-month trend. There is no
    // dedicated closed_at column, so `updated_at` is used as the close-date proxy.
    supabase
      .from("deals")
      .select("value, status, updated_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["won", "lost"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .gte("due_at", startOfToday.toISOString())
      .lte("due_at", endOfToday.toISOString()),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .lt("due_at", startOfToday.toISOString()),
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(7),
    supabase
      .from("companies")
      .select("created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "lead")
      .gte("created_at", twoWeeksAgo.toISOString()),
    supabase
      .from("activities")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // --- Open pipeline ---
  const deals = (openDealsData ?? []) as Pick<
    Deal,
    "id" | "value" | "stage_id" | "probability"
  >[];
  const pipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const weightedPipeline = deals.reduce(
    (sum, d) => sum + (d.value ?? 0) * ((d.probability ?? 0) / 100),
    0
  );

  const stageList = (stages ?? []) as DealStage[];
  const dealsByStage = stageList.map((stage) => {
    const inStage = deals.filter((d) => d.stage_id === stage.id);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
    };
  });

  // --- Won / conversion ---
  const closed = (closedDealsData ?? []) as {
    value: number | null;
    status: "won" | "lost";
    updated_at: string;
  }[];
  const wonDeals = closed.filter((d) => d.status === "won");
  const wonCount = wonDeals.length;
  const lostCount = closed.length - wonCount;
  const winRate = closed.length > 0 ? wonCount / closed.length : 0;

  const startOfMonthMs = startOfMonth.getTime();
  const startOfLastMonthMs = startOfLastMonth.getTime();
  let wonThisMonthValue = 0;
  let wonThisMonthCount = 0;
  let wonLastMonthValue = 0;
  for (const d of wonDeals) {
    const closedMs = new Date(d.updated_at).getTime();
    if (closedMs >= startOfMonthMs) {
      wonThisMonthValue += d.value ?? 0;
      wonThisMonthCount += 1;
    } else if (closedMs >= startOfLastMonthMs) {
      wonLastMonthValue += d.value ?? 0;
    }
  }
  const wonValueDeltaPct = pctChange(wonThisMonthValue, wonLastMonthValue);

  // --- Leads (this week vs prior week) ---
  const leadRows = (leadCompanyRows ?? []) as { created_at: string }[];
  const weekAgoMs = weekAgo.getTime();
  let newLeadsThisWeek = 0;
  let newLeadsLastWeek = 0;
  for (const c of leadRows) {
    if (new Date(c.created_at).getTime() >= weekAgoMs) newLeadsThisWeek += 1;
    else newLeadsLastWeek += 1;
  }
  const leadsDeltaPct = pctChange(newLeadsThisWeek, newLeadsLastWeek);

  // --- Upcoming tasks (flag overdue ones, matching the overdue count above) ---
  const startOfTodayMs = startOfToday.getTime();
  const upcoming: UpcomingTask[] = ((upcomingTasks ?? []) as Task[]).map(
    (t) => ({
      ...t,
      overdue: t.due_at != null && new Date(t.due_at).getTime() < startOfTodayMs,
    })
  );

  return {
    openDeals: deals.length,
    pipelineValue,
    weightedPipeline,
    dealsByStage,
    wonThisMonthValue,
    wonThisMonthCount,
    wonValueDeltaPct,
    wonCount,
    lostCount,
    winRate,
    tasksDueToday: dueTodayCount ?? 0,
    overdueTasks: overdueCount ?? 0,
    upcomingTasks: upcoming,
    newLeadsThisWeek,
    newLeadsLastWeek,
    leadsDeltaPct,
    recentActivity: (recentActivity ?? []) as Activity[],
  };
}
