import { createClient } from "@/lib/supabase/server";
import type {
  CalendarEvent,
  CalendarEventAttendee,
} from "@/lib/db/types";

export async function listEventsInRange(
  workspaceId: string,
  fromISO: string,
  toISO: string
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "confirmed")
    .gte("start_at", fromISO)
    .lte("start_at", toISO)
    .order("start_at", { ascending: true });
  return (data ?? []) as CalendarEvent[];
}

export async function getEvent(
  workspaceId: string,
  id: string
): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<CalendarEvent>();
  return data;
}

export async function listAttendees(
  eventId: string
): Promise<CalendarEventAttendee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_event_attendees")
    .select("*")
    .eq("event_id", eventId);
  return (data ?? []) as CalendarEventAttendee[];
}
