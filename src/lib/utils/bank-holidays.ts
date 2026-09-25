/**
 * Pure UK bank-holiday helpers, safe on client and server. The server module
 * `src/features/tools/bank-holidays.ts` (fetching + caching the GOV.UK feed)
 * re-exports these; pages pass plain {date, title} data down to client
 * components, which match with `bankHolidayOn`.
 */
export interface BankHoliday {
  /** "YYYY-MM-DD" */
  date: string;
  title: string;
  notes?: string;
}

/** Just what client components need. */
export type BankHolidaySlim = Pick<BankHoliday, "date" | "title">;

const ukDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The UK calendar date ("YYYY-MM-DD") of a value. Bank holidays are UK dates,
 * so a stored UTC timestamp must be read in UK time: 2026-05-24T23:00Z is
 * already 25 May in BST. A plain date, or a zone-less `datetime-local` value
 * ("2026-05-25T09:00"), is already a wall-clock date and is used as-is.
 */
export function ukDateOf(value: string | Date): string | null {
  if (typeof value === "string") {
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !hasZone) {
      return value.slice(0, 10);
    }
  }
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : ukDate.format(d);
}

/** Today's date in the UK, independent of the server's or browser's zone. */
export function todayInUk(now: Date = new Date()): string {
  return ukDate.format(now);
}

/** The holiday falling on a date, timestamp or datetime-local value, if any. */
export function bankHolidayOn<T extends BankHolidaySlim>(
  holidays: readonly T[],
  value: string | null | undefined
): T | null {
  if (!value) return null;
  const day = ukDateOf(value);
  return day ? (holidays.find((h) => h.date === day) ?? null) : null;
}

/** The next `count` holidays on or after `from` ("YYYY-MM-DD"). */
export function upcomingHolidays<T extends BankHolidaySlim>(
  holidays: readonly T[],
  from: string,
  count = 3
): T[] {
  return holidays.filter((h) => h.date >= from).slice(0, count);
}
