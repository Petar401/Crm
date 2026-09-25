import "server-only";

import {
  bankHolidayOn,
  todayInUk,
  upcomingHolidays,
  type BankHoliday,
} from "@/lib/utils/bank-holidays";

export { bankHolidayOn, todayInUk, upcomingHolidays, type BankHoliday };

/**
 * UK bank holidays from GOV.UK's public JSON feed — no API key or signup.
 * Cached for a day by Next's fetch cache; the feed changes a few times a year.
 */
const FEED_URL = "https://www.gov.uk/bank-holidays.json";
const TIMEOUT_MS = 5000;
const REVALIDATE_S = 60 * 60 * 24;

export const BANK_HOLIDAY_DIVISIONS = [
  "england-and-wales",
  "scotland",
  "northern-ireland",
] as const;
export type BankHolidayDivision = (typeof BANK_HOLIDAY_DIVISIONS)[number];

/** Default for an East Anglia business. */
export const DEFAULT_DIVISION: BankHolidayDivision = "england-and-wales";

export type BankHolidayFeed = Partial<
  Record<BankHolidayDivision, { events: BankHoliday[] }>
>;

export function isDivision(value: unknown): value is BankHolidayDivision {
  return (
    typeof value === "string" &&
    (BANK_HOLIDAY_DIVISIONS as readonly string[]).includes(value)
  );
}

/**
 * Per-instance memo on top of Next's fetch cache. Pages that show holidays are
 * rendered dynamically, where the fetch cache may be bypassed, so without this
 * every dashboard load would call GOV.UK. Failures are remembered briefly so
 * an outage costs one timeout, not one per page view.
 */
const MEMO_OK_MS = REVALIDATE_S * 1000;
const MEMO_FAIL_MS = 5 * 60 * 1000;
/** The last good feed is kept (served stale) when a refresh fails. */
let memo: { at: number; feed: BankHolidayFeed | null; ok: boolean } | null = null;
/** One fetch at a time: concurrent requests at expiry share it. */
let inflight: Promise<BankHolidayFeed | null> | null = null;

/** Fetches the feed. Returns null when GOV.UK can't be reached. */
export async function fetchBankHolidayFeed(): Promise<BankHolidayFeed | null> {
  if (memo && Date.now() - memo.at < (memo.ok ? MEMO_OK_MS : MEMO_FAIL_MS)) {
    return memo.feed;
  }
  inflight ??= fetchFeedUncached()
    .then((feed) => {
      memo = feed
        ? { at: Date.now(), feed, ok: true }
        : // Keep serving the last good feed; retry after the short interval.
          { at: Date.now(), feed: memo?.feed ?? null, ok: false };
      return memo.feed;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test hook: forget the memoised feed. */
export function resetBankHolidayMemo(): void {
  memo = null;
  inflight = null;
}

async function fetchFeedUncached(): Promise<BankHolidayFeed | null> {
  try {
    const res = await fetch(FEED_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) return null;
    return (await res.json()) as BankHolidayFeed;
  } catch {
    return null;
  }
}

/** All holidays for a division, sorted by date. */
export function holidaysFor(
  feed: BankHolidayFeed | null,
  division: BankHolidayDivision = DEFAULT_DIVISION
): BankHoliday[] {
  const events = feed?.[division]?.events ?? [];
  return events
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({ date: e.date, title: e.title, notes: e.notes ?? "" }))
    .sort((a, b) => a.date.localeCompare(b.date));
}




/** Convenience: fetch + filter in one call, for pages, Aria and MCP. */
export async function getBankHolidays(
  division: BankHolidayDivision = DEFAULT_DIVISION
): Promise<BankHoliday[] | null> {
  const feed = await fetchBankHolidayFeed();
  return feed ? holidaysFor(feed, division) : null;
}
