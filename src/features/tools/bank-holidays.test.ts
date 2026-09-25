import { describe, expect, it } from "vitest";

import {
  bankHolidayOn,
  holidaysFor,
  isDivision,
  todayInUk,
  upcomingHolidays,
  type BankHolidayFeed,
} from "./bank-holidays";

const feed: BankHolidayFeed = {
  "england-and-wales": {
    events: [
      { title: "Christmas Day", date: "2026-12-25", notes: "" },
      { title: "Summer bank holiday", date: "2026-08-31", notes: "" },
      { title: "Boxing Day", date: "2026-12-28", notes: "Substitute day" },
      { title: "New Year’s Day", date: "2027-01-01", notes: "" },
    ],
  },
  scotland: {
    events: [{ title: "St Andrew’s Day", date: "2026-11-30", notes: "" }],
  },
};

describe("bank holidays", () => {
  it("sorts a division's holidays and defaults to England and Wales", () => {
    expect(holidaysFor(feed).map((h) => h.date)).toEqual([
      "2026-08-31",
      "2026-12-25",
      "2026-12-28",
      "2027-01-01",
    ]);
    expect(holidaysFor(feed, "scotland")).toHaveLength(1);
    expect(holidaysFor(feed, "northern-ireland")).toEqual([]);
    expect(holidaysFor(null)).toEqual([]);
  });

  it("returns upcoming holidays from a date (inclusive)", () => {
    const list = holidaysFor(feed);
    expect(upcomingHolidays(list, "2026-12-25", 2).map((h) => h.title)).toEqual([
      "Christmas Day",
      "Boxing Day",
    ]);
  });

  it("finds the holiday on a date or timestamp", () => {
    const list = holidaysFor(feed);
    expect(bankHolidayOn(list, "2026-12-28T09:00:00Z")?.title).toBe("Boxing Day");
    expect(bankHolidayOn(list, "2026-12-29")).toBeNull();
  });

  it("validates divisions", () => {
    expect(isDivision("scotland")).toBe(true);
    expect(isDivision("wales")).toBe(false);
  });

  it("computes today in UK time", () => {
    // 23:30 UTC on 30 June is already 1 July in BST.
    expect(todayInUk(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // GMT in winter.
    expect(todayInUk(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });
});
