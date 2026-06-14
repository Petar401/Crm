import { Briefcase, CheckSquare, PoundSterling, UserPlus } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getDashboardData } from "@/features/dashboard/queries";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { PipelineFunnel } from "@/features/dashboard/components/pipeline-funnel";
import { WinRate } from "@/features/dashboard/components/win-rate";
import { TasksPanel } from "@/features/dashboard/components/tasks-panel";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  const [data, { allowed }] = await Promise.all([
    getDashboardData(ctx.workspace.id),
    getPermissionSet(),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${
          ctx.profile?.full_name ? `, ${ctx.profile.full_name}` : ""
        }`}
      />

      {/* Row 1: KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open pipeline"
          value={formatCurrency(data.pipelineValue)}
          sub={`${data.openDeals} open deal${data.openDeals === 1 ? "" : "s"}`}
          icon={PoundSterling}
          href={allowed.has("deals.view") ? "/deals" : undefined}
        />
        <KpiCard
          label="Won this month"
          value={formatCurrency(data.wonThisMonthValue)}
          sub={`${data.wonThisMonthCount} deal${
            data.wonThisMonthCount === 1 ? "" : "s"
          } closed`}
          icon={Briefcase}
          trend={data.wonValueDeltaPct}
          href={allowed.has("deals.view") ? "/deals" : undefined}
        />
        <KpiCard
          label="Tasks due today"
          value={String(data.tasksDueToday)}
          sub={
            data.overdueTasks > 0 ? (
              <span className="text-destructive">
                {data.overdueTasks} overdue
              </span>
            ) : (
              "Nothing overdue"
            )
          }
          icon={CheckSquare}
          href={allowed.has("tasks.view") ? "/tasks" : undefined}
        />
        <KpiCard
          label="New leads this week"
          value={String(data.newLeadsThisWeek)}
          sub={`vs ${data.newLeadsLastWeek} last week`}
          icon={UserPlus}
          trend={data.leadsDeltaPct}
          href={allowed.has("leads.view") ? "/leads" : undefined}
        />
      </div>

      {/* Row 2: pipeline funnel + win rate */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel data={data.dealsByStage} total={data.pipelineValue} />
        </div>
        <WinRate
          winRate={data.winRate}
          wonCount={data.wonCount}
          lostCount={data.lostCount}
          weightedPipeline={data.weightedPipeline}
        />
      </div>

      {/* Row 3: tasks + activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TasksPanel
          tasks={data.upcomingTasks}
          overdue={data.overdueTasks}
          dueToday={data.tasksDueToday}
        />
        <ActivityFeed activities={data.recentActivity} />
      </div>
    </div>
  );
}
