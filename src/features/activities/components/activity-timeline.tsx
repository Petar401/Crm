import {
  Activity as ActivityIcon,
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckCircle2,
  ArrowRightLeft,
  Paperclip,
  type LucideIcon,
} from "lucide-react";

import type { Activity, ActivityType } from "@/lib/db/types";
import { formatDateTime } from "@/lib/utils/format";
import { EmptyState } from "@/components/shared/empty-state";

const ICONS: Record<ActivityType, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task_created: CheckCircle2,
  task_completed: CheckCircle2,
  stage_changed: ArrowRightLeft,
  file_uploaded: Paperclip,
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Updates to this record will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = ICONS[activity.type] ?? ActivityIcon;
        return (
          <div key={activity.id} className="flex gap-3">
            <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{activity.title ?? activity.type}</p>
              {activity.detail && (
                <p className="text-muted-foreground text-sm">
                  {activity.detail}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {formatDateTime(activity.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
