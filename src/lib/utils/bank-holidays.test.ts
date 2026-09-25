import { describe, expect, it } from "vitest";

import { bankHolidayOn, todayInUk, ukDateOf, upcomingHolidays } from "./bank-holidays";
import { toDateTimeLocalValue } from "./format";

const holidays = [
  { date: "2026-05-25", title: "Spring bank holiday" },
  { date: "2026-08-31", title: "Summer bank holiday" },
];

describe("ukDateOf", () => {
  it("reads UTC timestamps in UK time (BST)", () => {
    // 23:00Z on 24 May is midnight on 25 May in BST.
    expect(ukDateOf("2026-05-24T23:00:00.000Z")).toBe("2026-05-25");
    expect(ukDateOf("2026-05-25T23:30:00Z")).toBe("2026-05-26");
  });

  it("uses plain dates and datetime-local values as-is", () => {
    expect(ukDateOf("2026-05-25")).toBe("2026-05-25");
    expect(ukDateOf("2026-05-25T00:30")).toBe("2026-05-25");
  });

  it("returns null for garbage", () => {
    expect(ukDateOf("not a date")).toBeNull();
  });
});

describe("bankHolidayOn", () => {
  it("matches a task due at midnight BST on the holiday", () => {
    expect(bankHolidayOn(holidays, "2026-05-24T23:00:00Z")?.title).toBe("Spring bank holiday");
  });

  it("doesn't match a task due just after midnight the next day", () => {
    expect(bankHolidayOn(holidays, "2026-05-25T23:30:00Z")).toBeNull();
  });

  it("handles empty input", () => {
    expect(bankHolidayOn(holidays, null)).toBeNull();
    expect(bankHolidayOn([], "2026-05-25")).toBeNull();
  });
});

describe("upcomingHolidays / todayInUk", () => {
  it("lists from a date inclusive", () => {
    expect(upcomingHolidays(holidays, "2026-05-25", 5)).toHaveLength(2);
    expect(upcomingHolidays(holidays, "2026-05-26", 5)).toHaveLength(1);
  });

  it("computes today in UK time", () => {
    expect(todayInUk(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
  });
});

describe("toDateTimeLocalValue", () => {
  it("round-trips through the datetime-local input without shifting", () => {
    const iso = "2026-05-25T08:30:00.000Z";
    const local = toDateTimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // What the form does on save: interpret the input as local time.
    expect(new Date(local).toISOString()).toBe(iso);
  });

  it("returns an empty string for an invalid timestamp", () => {
    expect(toDateTimeLocalValue("nope")).toBe("");
  });
});
