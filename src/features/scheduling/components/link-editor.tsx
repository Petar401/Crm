"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Availability, SchedulingLink } from "@/lib/db/types";
import { createLink, updateLink } from "@/features/scheduling/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  link?: SchedulingLink;
  userTimezone: string;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DEFAULT_AVAIL: Availability = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
  sat: [],
  sun: [],
};

export function LinkEditor({
  open,
  onOpenChange,
  link,
  userTimezone,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!link;

  const [state, setState] = useState({
    slug: link?.slug ?? "",
    title: link?.title ?? "30-minute intro",
    description: link?.description ?? "",
    duration_minutes: link?.duration_minutes ?? 30,
    buffer_before_minutes: link?.buffer_before_minutes ?? 0,
    buffer_after_minutes: link?.buffer_after_minutes ?? 0,
    timezone: link?.timezone ?? userTimezone,
    min_notice_minutes: link?.min_notice_minutes ?? 120,
    max_days_ahead: link?.max_days_ahead ?? 30,
    is_active: link?.is_active ?? true,
    availability: (link?.availability as Availability) ?? DEFAULT_AVAIL,
  });

  function setDay(day: Day, index: number, patch: { start?: string; end?: string }) {
    setState((s) => {
      const arr = [...(s.availability[day] ?? [])];
      arr[index] = { ...arr[index], ...patch };
      return { ...s, availability: { ...s.availability, [day]: arr } };
    });
  }

  function addWindow(day: Day) {
    setState((s) => ({
      ...s,
      availability: {
        ...s.availability,
        [day]: [...(s.availability[day] ?? []), { start: "09:00", end: "17:00" }],
      },
    }));
  }

  function removeWindow(day: Day, index: number) {
    setState((s) => ({
      ...s,
      availability: {
        ...s.availability,
        [day]: (s.availability[day] ?? []).filter((_, i) => i !== index),
      },
    }));
  }

  function save() {
    startTransition(async () => {
      const filled: Availability = {};
      for (const d of DAYS) filled[d] = state.availability[d] ?? [];
      const payload = { ...state, availability: filled };
      const r = isEdit ? await updateLink(link!.id, payload) : await createLink(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Link updated" : "Link created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit booking link" : "New booking link"}
          </SheetTitle>
          <SheetDescription>
            Anyone with the URL can pick a slot on your calendar.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slug</Label>
              <Input
                value={state.slug}
                onChange={(e) =>
                  setState((s) => ({ ...s, slug: e.target.value.toLowerCase() }))
                }
                placeholder="jane-intro"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Lowercase letters, numbers, dashes.
              </p>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={state.duration_minutes}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    duration_minutes: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={state.description}
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Buffer before</Label>
              <Input
                type="number"
                min={0}
                value={state.buffer_before_minutes}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    buffer_before_minutes: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
            <div>
              <Label>Buffer after</Label>
              <Input
                type="number"
                min={0}
                value={state.buffer_after_minutes}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    buffer_after_minutes: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
            <div>
              <Label>Min notice</Label>
              <Input
                type="number"
                min={0}
                value={state.min_notice_minutes}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    min_notice_minutes: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Timezone</Label>
              <Input
                value={state.timezone}
                onChange={(e) =>
                  setState((s) => ({ ...s, timezone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Max days ahead</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={state.max_days_ahead}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    max_days_ahead: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-muted-foreground text-xs">
                Turn off to pause new bookings without deleting the link.
              </p>
            </div>
            <Switch
              checked={state.is_active}
              onCheckedChange={(v) => setState((s) => ({ ...s, is_active: v }))}
            />
          </div>

          <div>
            <Label>Weekly availability</Label>
            <div className="mt-2 space-y-2 text-sm">
              {DAYS.map((day) => {
                const windows = state.availability[day] ?? [];
                return (
                  <div key={day} className="flex items-start gap-2 rounded border p-2">
                    <div className="w-10 pt-1 font-medium uppercase">{day}</div>
                    <div className="flex-1 space-y-1">
                      {windows.length === 0 ? (
                        <p className="text-muted-foreground">Off</p>
                      ) : (
                        windows.map((w, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Input
                              type="time"
                              className="w-24"
                              value={w.start}
                              onChange={(e) =>
                                setDay(day, i, { start: e.target.value })
                              }
                            />
                            <span>–</span>
                            <Input
                              type="time"
                              className="w-24"
                              value={w.end}
                              onChange={(e) =>
                                setDay(day, i, { end: e.target.value })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWindow(day, i)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addWindow(day)}
                    >
                      Add
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <SheetFooter className="px-4">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create link"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
