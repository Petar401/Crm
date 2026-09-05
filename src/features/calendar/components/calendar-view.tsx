"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type { CalendarEvent, Company, Contact, Deal } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EventDialog } from "@/features/calendar/components/event-dialog";

type View = "month" | "week" | "day";

interface Props {
  events: CalendarEvent[];
  initialDate: string;
  initialView: View;
  deals: Pick<Deal, "id" | "name" | "company_id" | "primary_contact_id">[];
  companies: Pick<Company, "id" | "name">[];
  contacts: Pick<Contact, "id" | "full_name" | "company_id" | "email">[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CalendarView({
  events,
  initialDate,
  initialView,
  deals,
  companies,
  contacts,
  canCreate,
  canUpdate,
  canDelete,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(initialView);
  const [focus, setFocus] = useState<Date>(new Date(initialDate));
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ start: string; end: string } | null>(
    null
  );

  function nav(deltaDir: "prev" | "next" | "today") {
    const now = new Date();
    let next: Date;
    if (deltaDir === "today") next = now;
    else {
      const dir = deltaDir === "next" ? 1 : -1;
      if (view === "month") next = addMonths(focus, dir);
      else if (view === "week") next = addWeeks(focus, dir);
      else next = addDays(focus, dir);
    }
    setFocus(next);
    const params = new URLSearchParams(searchParams);
    params.set("date", format(next, "yyyy-MM-dd"));
    params.set("view", view);
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  }

  function switchView(v: View) {
    setView(v);
    const params = new URLSearchParams(searchParams);
    params.set("view", v);
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  }

  const title = useMemo(() => {
    if (view === "month") return format(focus, "MMMM yyyy");
    if (view === "week") {
      const s = startOfWeek(focus, { weekStartsOn: 1 });
      const e = endOfWeek(focus, { weekStartsOn: 1 });
      return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
    }
    return format(focus, "EEEE, d MMMM yyyy");
  }, [focus, view]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => nav("today")}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nav("prev")}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nav("next")}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => switchView(v as View)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreate && (
            <Button onClick={() => {
              setPrefill(null);
              setNewOpen(true);
            }}>
              <Plus className="size-4" />
              New event
            </Button>
          )}
        </div>
      </div>

      {view === "month" && (
        <MonthGrid
          focus={focus}
          events={events}
          onOpenEvent={setOpenEvent}
          onCreate={(day) => {
            const start = new Date(day);
            start.setHours(9, 0, 0, 0);
            const end = new Date(day);
            end.setHours(10, 0, 0, 0);
            setPrefill({
              start: toLocalInput(start),
              end: toLocalInput(end),
            });
            setNewOpen(true);
          }}
          canCreate={canCreate}
        />
      )}
      {view === "week" && (
        <WeekOrDayGrid
          focus={focus}
          span="week"
          events={events}
          onOpenEvent={setOpenEvent}
          onCreate={(start, end) => {
            setPrefill({
              start: toLocalInput(start),
              end: toLocalInput(end),
            });
            setNewOpen(true);
          }}
          canCreate={canCreate}
        />
      )}
      {view === "day" && (
        <WeekOrDayGrid
          focus={focus}
          span="day"
          events={events}
          onOpenEvent={setOpenEvent}
          onCreate={(start, end) => {
            setPrefill({
              start: toLocalInput(start),
              end: toLocalInput(end),
            });
            setNewOpen(true);
          }}
          canCreate={canCreate}
        />
      )}

      {(newOpen || openEvent) && (
        <EventDialog
          open={newOpen || !!openEvent}
          onOpenChange={(o) => {
            if (!o) {
              setNewOpen(false);
              setOpenEvent(null);
              setPrefill(null);
            }
          }}
          event={openEvent ?? undefined}
          defaultStart={prefill?.start}
          defaultEnd={prefill?.end}
          deals={deals}
          companies={companies}
          contacts={contacts}
          canUpdate={openEvent ? canUpdate : true}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Month grid
// --------------------------------------------------------------------------

function MonthGrid({
  focus,
  events,
  onOpenEvent,
  onCreate,
  canCreate,
}: {
  focus: Date;
  events: CalendarEvent[];
  onOpenEvent: (e: CalendarEvent) => void;
  onCreate: (day: Date) => void;
  canCreate: boolean;
}) {
  const gridStart = startOfWeek(startOfMonth(focus), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(focus), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = format(parseISO(e.start_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/40 grid grid-cols-7 text-xs font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="p-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const isCurrent = isSameMonth(day, focus);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`min-h-[110px] cursor-pointer border-t border-r p-1.5 text-xs ${
                isCurrent ? "" : "text-muted-foreground bg-muted/20"
              }`}
              onClick={() => canCreate && onCreate(day)}
            >
              <div
                className={`mb-1 inline-flex size-6 items-center justify-center rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground font-semibold"
                    : ""
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpenEvent(e);
                    }}
                    className="truncate rounded bg-blue-100 px-1 py-0.5 text-blue-800 hover:bg-blue-200"
                  >
                    {format(parseISO(e.start_at), "HH:mm")} {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Week / Day grid (single-day = week grid with 1 column)
// --------------------------------------------------------------------------

function WeekOrDayGrid({
  focus,
  span,
  events,
  onOpenEvent,
  onCreate,
  canCreate,
}: {
  focus: Date;
  span: "week" | "day";
  events: CalendarEvent[];
  onOpenEvent: (e: CalendarEvent) => void;
  onCreate: (start: Date, end: Date) => void;
  canCreate: boolean;
}) {
  const days =
    span === "week"
      ? eachDayOfInterval({
          start: startOfWeek(focus, { weekStartsOn: 1 }),
          end: endOfWeek(focus, { weekStartsOn: 1 }),
        })
      : [focus];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className="bg-muted/40 grid gap-0 text-xs font-medium"
        style={{
          gridTemplateColumns: `60px repeat(${days.length}, minmax(0,1fr))`,
        }}
      >
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="p-2">
            {format(d, "EEE d MMM")}
          </div>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `60px repeat(${days.length}, minmax(0,1fr))`,
          }}
        >
          {hours.map((h) => (
            <>
              <div
                key={`h-${h}`}
                className="text-muted-foreground -mt-2 pr-2 pt-2 text-right text-[10px]"
              >
                {h}:00
              </div>
              {days.map((day) => {
                const bucketStart = new Date(day);
                bucketStart.setHours(h, 0, 0, 0);
                const bucketEnd = new Date(day);
                bucketEnd.setHours(h + 1, 0, 0, 0);
                const bucketEvents = events.filter((e) => {
                  const s = parseISO(e.start_at);
                  return isSameDay(s, day) && s.getHours() === h;
                });
                return (
                  <div
                    key={`${day.toISOString()}-${h}`}
                    className="relative min-h-[48px] cursor-pointer border-t border-r hover:bg-blue-50/40"
                    onClick={() => canCreate && onCreate(bucketStart, bucketEnd)}
                  >
                    {bucketEvents.map((e) => {
                      const s = parseISO(e.start_at);
                      const en = parseISO(e.end_at);
                      const mins = Math.max(15, differenceInMinutes(en, s));
                      return (
                        <button
                          key={e.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onOpenEvent(e);
                          }}
                          className="absolute left-1 right-1 rounded bg-blue-100 p-1 text-left text-[11px] text-blue-800 hover:bg-blue-200"
                          style={{
                            top: `${(s.getMinutes() / 60) * 48}px`,
                            height: `${(mins / 60) * 48 - 4}px`,
                          }}
                        >
                          <div className="font-medium">{e.title}</div>
                          <div className="text-[10px]">
                            {format(s, "HH:mm")}–{format(en, "HH:mm")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
