import {
  Activity as ActivityIcon,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  ListPlus,
  Mail,
  Paperclip,
  Phone,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils/format";
import type { Activity, ActivityType } from "@/lib/db/types";

const ACTIVITY_META: Record<
  ActivityType,
  { icon: LucideIcon; className: string }
> = {
  note: {
    icon: StickyNote,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  call: {
    icon: Phone,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  email: {
    icon: Mail,
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  },
  meeting: {
    icon: CalendarClock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  task_created: {
    icon: ListPlus,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  task_completed: {
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  stage_changed: {
    icon: GitBranch,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  file_uploaded: {
    icon: Paperclip,
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activity yet"
            description="Actions across your workspace will show up here."
          />
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const meta = ACTIVITY_META[activity.type] ?? {
                icon: ActivityIcon,
                className: "bg-muted text-muted-foreground",
              };
              const Icon = meta.icon;
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      meta.className
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {activity.title ?? activity.type.replace(/_/g, " ")}
                    </p>
                    {activity.detail && (
                      <p className="text-muted-foreground truncate text-xs">
                        {activity.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDateTime(activity.created_at)}
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
