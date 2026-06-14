import { CheckSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils/format";
import type { TaskPriority } from "@/lib/db/types";
import type { UpcomingTask } from "@/features/dashboard/queries";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function TasksPanel({
  tasks,
  overdue,
  dueToday,
}: {
  tasks: UpcomingTask[];
  overdue: number;
  dueToday: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Upcoming tasks</CardTitle>
          <div className="flex items-center gap-3 text-xs">
            {overdue > 0 && (
              <span className="text-destructive font-medium">
                {overdue} overdue
              </span>
            )}
            <span className="text-muted-foreground">{dueToday} due today</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="All caught up"
            description="Tasks you create will appear here, soonest first."
          />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const isOverdue = task.overdue;
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn("capitalize", PRIORITY_STYLES[task.priority])}
                    >
                      {task.priority}
                    </Badge>
                    <span className="truncate text-sm">{task.title}</span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isOverdue
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {task.due_at ? formatDateTime(task.due_at) : "No date"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
