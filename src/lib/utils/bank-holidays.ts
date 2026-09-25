/**
 * Client-safe bank holiday helpers. `src/features/tools/bank-holidays.ts` has
 * `import "server-only"`, so client components (tasks list, task form) can't
 * import it directly — pages fetch there and pass plain {date,title} data
 * down as props, and this tiny pure helper matches on the client.
 */
export interface BankHolidaySlim {
  /** "YYYY-MM-DD" */
  date: string;
  title: string;
}

/** The holiday falling on a date ("YYYY-MM-DD" or ISO timestamp), if any. */
export function bankHolidayOnClient(
  holidays: readonly BankHolidaySlim[],
  date: string | null | undefined
): BankHolidaySlim | null {
  if (!date) return null;
  const day = date.slice(0, 10);
  return holidays.find((h) => h.date === day) ?? null;
}
