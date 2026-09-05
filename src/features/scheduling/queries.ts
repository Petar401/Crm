import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Availability,
  Booking,
  CalendarEvent,
  Profile,
  SchedulingLink,
} from "@/lib/db/types";

export async function listLinksForUser(
  userId: string
): Promise<SchedulingLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduling_links")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SchedulingLink[];
}

export async function getLink(
  workspaceId: string,
  id: string
): Promise<SchedulingLink | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduling_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<SchedulingLink>();
  return data;
}

export async function listBookings(linkId: string): Promise<Booking[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("scheduling_link_id", linkId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Booking[];
}

export interface PublicLink {
  link: SchedulingLink;
  owner: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;
}

/**
 * Resolve a public /book/[slug] link. Bypasses RLS (visitor is
 * unauthenticated). Returns null when the slug doesn't exist or the link
 * is disabled.
 */
export async function getPublicLinkBySlug(
  slug: string
): Promise<PublicLink | null> {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("scheduling_links")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<SchedulingLink>();
  if (!link || !link.is_active) return null;

  const { data: owner } = await admin
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", link.owner_user_id)
    .maybeSingle<Pick<Profile, "id" | "full_name" | "email" | "avatar_url">>();
  if (!owner) return null;

  return { link, owner };
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Free slots on a given local date, in the link's timezone, for its
 * duration, respecting min_notice / max_days_ahead and subtracting the
 * owner's confirmed calendar events on that day.
 */
export async function getFreeSlots(
  link: SchedulingLink,
  dayISO: string
): Promise<Date[]> {
  const day = new Date(`${dayISO}T00:00:00`);
  const now = new Date();
  const dayKey = DAY_KEYS[day.getDay()];
  const availability = link.availability as Availability;
  const windows = availability?.[dayKey] ?? [];
  if (windows.length === 0) return [];

  const min = new Date(now.getTime() + link.min_notice_minutes * 60_000);
  const max = new Date(now.getTime() + link.max_days_ahead * 86_400_000);

  const admin = createAdminClient();
  const { data: events } = await admin
    .from("calendar_events")
    .select("start_at, end_at, status, owner_user_id")
    .eq("owner_user_id", link.owner_user_id)
    .eq("status", "confirmed")
    .gte("start_at", new Date(day.getTime() - 3600_000).toISOString())
    .lte("start_at", new Date(day.getTime() + 26 * 3600_000).toISOString());

  const busy = ((events ?? []) as Pick<CalendarEvent, "start_at" | "end_at">[]).map(
    (e) => ({ start: new Date(e.start_at), end: new Date(e.end_at) })
  );

  const results: Date[] = [];
  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map((n) => parseInt(n, 10));
    const [eh, em] = w.end.split(":").map((n) => parseInt(n, 10));
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);

    const step = link.duration_minutes + link.buffer_before_minutes + link.buffer_after_minutes;
    for (
      let t = start.getTime();
      t + link.duration_minutes * 60_000 <= end.getTime();
      t += step * 60_000
    ) {
      const slotStart = new Date(t);
      if (slotStart < min || slotStart > max) continue;
      const slotEnd = new Date(t + link.duration_minutes * 60_000);
      const conflict = busy.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );
      if (!conflict) results.push(slotStart);
    }
  }
  return results;
}
