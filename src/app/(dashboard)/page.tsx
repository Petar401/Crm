import {
  Briefcase,
  PoundSterling,
  CheckSquare,
  UserPlus,
  Activity as ActivityIcon,
} from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getDashboardData } from "@/features/dashboard/queries";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  const data = await getDashboardData(ctx.workspace.id);

  const kpis = [
    {
      label: "Open deals",
      value: String(data.openDeals),
      icon: Briefcase,
    },
    {
      label: "Pipeline value",
      value: formatCurrency(data.pipelineValue),
      icon: PoundSterling,
    },
    {
      label: "Tasks due today",
      value: String(data.tasksDueToday),
      icon: CheckSquare,
    },
    {
      label: "New leads this week",
      value: String(data.newLeadsThisWeek),
      icon: UserPlus,
    },
  ];

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
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
              </div>
              <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
                <kpi.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: deals by stage + upcoming tasks */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deals by stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dealsByStage.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pipeline yet.</p>
            ) : (
              data.dealsByStage.map(({ stage, count, value }) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: stage.color ?? "#94a3b8" }}
                    />
                    <span className="text-sm">{stage.name}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {formatCurrency(value)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing scheduled. You&apos;re all caught up.
              </p>
            ) : (
              data.upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"
                >
                  <span className="truncate text-sm">{task.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {task.due_at ? formatDateTime(task.due_at) : "No date"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: recent activity */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState
                icon={ActivityIcon}
                title="No activity yet"
                description="Actions across your workspace will show up here."
              />
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="bg-muted mt-0.5 flex size-7 items-center justify-center rounded-full">
                      <ActivityIcon className="text-muted-foreground size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm">
                        {activity.title ?? activity.type}
                      </p>
                      {activity.detail && (
                        <p className="text-muted-foreground truncate text-xs">
                          {activity.detail}
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
