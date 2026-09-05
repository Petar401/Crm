"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { NotificationPreference, NotificationKind } from "@/lib/db/types";
import { NOTIFICATION_KIND_LABELS } from "@/features/notifications/kinds";
import { updateNotificationPreference } from "@/features/notifications/actions";
import { Switch } from "@/components/ui/switch";

interface PreferencesPanelProps {
  initial: NotificationPreference[];
}

export function PreferencesPanel({ initial }: PreferencesPanelProps) {
  const [rows, setRows] = useState<NotificationPreference[]>(initial);
  const [, startTransition] = useTransition();

  function toggle(kind: NotificationKind, field: "in_app" | "email", value: boolean) {
    const next = rows.map((r) =>
      r.kind === kind ? { ...r, [field]: value } : r
    );
    setRows(next);
    const target = next.find((r) => r.kind === kind);
    if (!target) return;
    startTransition(async () => {
      const res = await updateNotificationPreference({
        kind: target.kind,
        in_app: target.in_app,
        email: target.email,
      });
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <div className="rounded-md border">
      <div className="text-muted-foreground grid grid-cols-[1fr,80px,80px] gap-2 border-b px-3 py-2 text-xs font-medium">
        <span>Notification</span>
        <span className="text-center">In-app</span>
        <span className="text-center">Email</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.kind}
          className="grid grid-cols-[1fr,80px,80px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
        >
          <span>{NOTIFICATION_KIND_LABELS[r.kind]}</span>
          <div className="flex justify-center">
            <Switch
              checked={r.in_app}
              onCheckedChange={(v) => toggle(r.kind, "in_app", v)}
            />
          </div>
          <div className="flex justify-center">
            <Switch
              checked={r.email}
              onCheckedChange={(v) => toggle(r.kind, "email", v)}
            />
          </div>
        </div>
      ))}
      <p className="text-muted-foreground p-3 text-xs">
        Email delivery is not yet enabled — the toggle is stored for when it
        ships.
      </p>
    </div>
  );
}
