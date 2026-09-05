"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import type {
  CalendarEvent,
  Company,
  Contact,
  Deal,
} from "@/lib/db/types";
import {
  cancelEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/features/calendar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: CalendarEvent;
  defaultStart?: string;
  defaultEnd?: string;
  deals: Pick<Deal, "id" | "name" | "company_id" | "primary_contact_id">[];
  companies: Pick<Company, "id" | "name">[];
  contacts: Pick<Contact, "id" | "full_name" | "company_id" | "email">[];
  canUpdate: boolean;
  canDelete: boolean;
}

interface AttendeeDraft {
  email: string;
  name: string;
  contact_id: string;
}

const NONE = "__none";

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultStart,
  defaultEnd,
  deals,
  companies,
  contacts,
  canUpdate,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!event;

  const [state, setState] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    start_at: event ? toInput(event.start_at) : defaultStart ?? "",
    end_at: event ? toInput(event.end_at) : defaultEnd ?? "",
    all_day: event?.all_day ?? false,
    deal_id: event?.deal_id ?? "",
    company_id: event?.company_id ?? "",
    contact_id: event?.contact_id ?? "",
  });
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([]);

  const [seedKey, setSeedKey] = useState(event?.id ?? "new");
  const currentSeed = event?.id ?? "new";
  if (open && currentSeed !== seedKey) {
    setSeedKey(currentSeed);
    setState({
      title: event?.title ?? "",
      description: event?.description ?? "",
      location: event?.location ?? "",
      start_at: event ? toInput(event.start_at) : defaultStart ?? "",
      end_at: event ? toInput(event.end_at) : defaultEnd ?? "",
      all_day: event?.all_day ?? false,
      deal_id: event?.deal_id ?? "",
      company_id: event?.company_id ?? "",
      contact_id: event?.contact_id ?? "",
    });
    setAttendees([]);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        ...state,
        start_at: fromInput(state.start_at),
        end_at: fromInput(state.end_at),
        deal_id: state.deal_id || undefined,
        company_id: state.company_id || undefined,
        contact_id: state.contact_id || undefined,
        attendees: attendees
          .filter((a) => a.email)
          .map((a) => ({
            email: a.email,
            name: a.name || undefined,
            contact_id: a.contact_id || undefined,
          })),
      };
      const r = isEdit
        ? await updateEvent(event!.id, payload)
        : await createEvent(payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Event updated" : "Event created");
      onOpenChange(false);
      router.refresh();
    });
  }

  function cancelIt() {
    if (!event) return;
    startTransition(async () => {
      const r = await cancelEvent(event.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cancelled");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function del() {
    if (!event) return;
    startTransition(async () => {
      const r = await deleteEvent(event.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Deleted");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit event" : "New event"}</SheetTitle>
          <SheetDescription>
            Meetings, calls, blocks — synced to your calendar timelines.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div>
            <Label>Title</Label>
            <Input
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              placeholder="Discovery call"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={state.start_at}
                onChange={(e) =>
                  setState((s) => ({ ...s, start_at: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={state.end_at}
                onChange={(e) =>
                  setState((s) => ({ ...s, end_at: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={state.location}
              onChange={(e) =>
                setState((s) => ({ ...s, location: e.target.value }))
              }
              placeholder="Zoom link / room / address"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={state.description}
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Deal</Label>
              <Select
                value={state.deal_id || NONE}
                onValueChange={(v) => {
                  const dealId = v === NONE ? "" : v;
                  const deal = deals.find((d) => d.id === dealId);
                  setState((s) => ({
                    ...s,
                    deal_id: dealId,
                    company_id: deal?.company_id ?? s.company_id,
                    contact_id: deal?.primary_contact_id ?? s.contact_id,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company</Label>
              <Select
                value={state.company_id || NONE}
                onValueChange={(v) =>
                  setState((s) => ({ ...s, company_id: v === NONE ? "" : v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Attendees</Label>
            <div className="space-y-2">
              {attendees.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={a.email}
                    onChange={(e) =>
                      setAttendees((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, email: e.target.value } : x
                        )
                      )
                    }
                  />
                  <Input
                    placeholder="Name"
                    value={a.name}
                    onChange={(e) =>
                      setAttendees((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setAttendees((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAttendees((prev) => [
                    ...prev,
                    { email: "", name: "", contact_id: "" },
                  ])
                }
              >
                Add attendee
              </Button>
              {contacts.length > 0 && (
                <Select
                  onValueChange={(v) => {
                    const contact = contacts.find((c) => c.id === v);
                    if (!contact || !contact.email) return;
                    setAttendees((prev) => [
                      ...prev,
                      {
                        email: contact.email!,
                        name: contact.full_name,
                        contact_id: contact.id,
                      },
                    ]);
                  }}
                  value=""
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add from contacts" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts
                      .filter((c) => c.email)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} — {c.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
        <SheetFooter className="mt-4 flex justify-between px-4">
          <div className="flex gap-2">
            {canDelete && isEdit && (
              <Button variant="destructive" onClick={del} disabled={pending}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            {canUpdate && isEdit && event?.status !== "cancelled" && (
              <Button variant="outline" onClick={cancelIt} disabled={pending}>
                Cancel event
              </Button>
            )}
          </div>
          <Button onClick={save} disabled={pending || !canUpdate}>
            {pending ? "Saving…" : isEdit ? "Save" : "Create event"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function toInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromInput(v: string): string {
  return new Date(v).toISOString();
}
