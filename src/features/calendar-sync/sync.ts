import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { configFor } from "@/features/calendar-sync/config";
import {
  ensureFreshAccessToken,
  packTokens,
  unpackTokens,
  type StoredTokens,
} from "@/features/calendar-sync/tokens";
import type { CalendarAccount, CalendarEventStatus } from "@/lib/db/types";

interface NormalizedEvent {
  external_id: string;
  external_etag: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: CalendarEventStatus;
  cancelled: boolean;
}

/**
 * One incremental pass for a single account. Google uses `syncToken`,
 * Microsoft uses `@odata.deltaLink`; both return a token we persist for
 * the next call.
 */
export async function syncAccountOnce(
  account: CalendarAccount
): Promise<{ synced: number; error?: string }> {
  const config = configFor(account.provider);
  if (!config) {
    return { synced: 0, error: `${account.provider} OAuth is not configured` };
  }

  const admin = createAdminClient();
  const tokens = unpackTokens(account.encrypted_tokens);
  let fresh: StoredTokens;
  try {
    fresh = await ensureFreshAccessToken(config, tokens, async (t) => {
      await admin
        .from("calendar_accounts")
        .update({ encrypted_tokens: packTokens(t) })
        .eq("id", account.id);
    });
  } catch (err) {
    const message = (err as Error).message;
    await admin
      .from("calendar_accounts")
      .update({ last_sync_error: message })
      .eq("id", account.id);
    return { synced: 0, error: message };
  }

  const events =
    account.provider === "google"
      ? await syncGoogle(account, fresh.access_token)
      : await syncMicrosoft(account, fresh.access_token);

  if (events.error) {
    await admin
      .from("calendar_accounts")
      .update({ last_sync_error: events.error })
      .eq("id", account.id);
    return { synced: 0, error: events.error };
  }

  for (const ev of events.items) {
    if (ev.cancelled) {
      await admin
        .from("calendar_events")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("source", account.provider)
        .eq("external_id", ev.external_id);
      continue;
    }
    await admin.from("calendar_events").upsert(
      {
        workspace_id: account.workspace_id,
        owner_user_id: account.user_id,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        start_at: ev.start_at,
        end_at: ev.end_at,
        all_day: ev.all_day,
        status: ev.status,
        source: account.provider,
        external_id: ev.external_id,
        external_etag: ev.external_etag,
        external_calendar_id: account.external_calendar_id,
        created_by: account.user_id,
      },
      { onConflict: "source,external_id" }
    );
  }

  await admin
    .from("calendar_accounts")
    .update({
      sync_token: events.nextSyncToken ?? account.sync_token,
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("id", account.id);

  return { synced: events.items.length };
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

async function syncGoogle(
  account: CalendarAccount,
  accessToken: string
): Promise<{ items: NormalizedEvent[]; nextSyncToken?: string; error?: string }> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      account.external_calendar_id
    )}/events`
  );
  if (account.sync_token) url.searchParams.set("syncToken", account.sync_token);
  else {
    // First run: pull the next 60 days as a bounded initial window.
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 60 * 86400_000).toISOString();
    url.searchParams.set("timeMin", from);
    url.searchParams.set("timeMax", to);
    url.searchParams.set("singleEvents", "true");
  }
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 410) {
    // syncToken expired — clear it, next run will do a fresh initial sync.
    return { items: [], nextSyncToken: undefined, error: undefined };
  }
  if (!res.ok) return { items: [], error: `google ${res.status}` };
  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      etag?: string;
      status?: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
    nextSyncToken?: string;
  };
  const items: NormalizedEvent[] = (json.items ?? []).map((g) => ({
    external_id: g.id,
    external_etag: g.etag ?? null,
    title: g.summary ?? "(no title)",
    description: g.description ?? null,
    location: g.location ?? null,
    start_at: g.start?.dateTime ?? `${g.start?.date}T00:00:00Z`,
    end_at: g.end?.dateTime ?? `${g.end?.date}T23:59:59Z`,
    all_day: !g.start?.dateTime,
    status: g.status === "cancelled" ? "cancelled" : "confirmed",
    cancelled: g.status === "cancelled",
  }));
  return { items, nextSyncToken: json.nextSyncToken };
}

// ---------------------------------------------------------------------------
// Microsoft Graph
// ---------------------------------------------------------------------------

async function syncMicrosoft(
  account: CalendarAccount,
  accessToken: string
): Promise<{ items: NormalizedEvent[]; nextSyncToken?: string; error?: string }> {
  const url = account.sync_token
    ? new URL(account.sync_token)
    : new URL("https://graph.microsoft.com/v1.0/me/calendarView/delta");
  if (!account.sync_token) {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 60 * 86400_000).toISOString();
    url.searchParams.set("startDateTime", from);
    url.searchParams.set("endDateTime", to);
  }
  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${accessToken}`,
      Prefer: 'odata.track-changes, outlook.timezone="UTC"',
    },
  });
  if (!res.ok) return { items: [], error: `microsoft ${res.status}` };
  const json = (await res.json()) as {
    value?: Array<{
      id: string;
      "@odata.etag"?: string;
      subject?: string;
      bodyPreview?: string;
      location?: { displayName?: string };
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      isAllDay?: boolean;
      isCancelled?: boolean;
      "@removed"?: unknown;
    }>;
    "@odata.deltaLink"?: string;
    "@odata.nextLink"?: string;
  };
  const items: NormalizedEvent[] = (json.value ?? []).map((m) => ({
    external_id: m.id,
    external_etag: m["@odata.etag"] ?? null,
    title: m.subject ?? "(no title)",
    description: m.bodyPreview ?? null,
    location: m.location?.displayName ?? null,
    start_at: m.start?.dateTime
      ? new Date(m.start.dateTime + "Z").toISOString()
      : new Date().toISOString(),
    end_at: m.end?.dateTime
      ? new Date(m.end.dateTime + "Z").toISOString()
      : new Date().toISOString(),
    all_day: !!m.isAllDay,
    status: m.isCancelled ? "cancelled" : "confirmed",
    cancelled: !!m.isCancelled || !!m["@removed"],
  }));
  return { items, nextSyncToken: json["@odata.deltaLink"] };
}
