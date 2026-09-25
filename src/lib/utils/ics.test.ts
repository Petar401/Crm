import { describe, expect, it } from "vitest";

import { buildIcs, escapeIcsText, foldIcsLine } from "./ics";

const NOW = new Date("2026-09-25T12:00:00Z");

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:Hi")).toBe("SUMMARY:Hi");
  });

  it("folds at 75 octets without splitting multi-byte characters", () => {
    const line = "DESCRIPTION:" + "é".repeat(60);
    const folded = foldIcsLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildIcs", () => {
  it("builds all-day and timed events", () => {
    const ics = buildIcs(
      [
        { uid: "task-1@crm", title: "Call Acme, re: quote", start: "2026-10-01" },
        {
          uid: "task-2@crm",
          title: "Site visit",
          start: "2026-10-02T09:30:00Z",
          description: "Bring samples\nand forms",
        },
      ],
      { calendarName: "CRM tasks", now: NOW }
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261002");
    expect(ics).toContain("SUMMARY:Call Acme\\, re: quote");
    expect(ics).toContain("DTSTART:20261002T093000Z\r\nDTEND:20261002T100000Z");
    expect(ics).toContain("DESCRIPTION:Bring samples\\nand forms");
    expect(ics).toContain("DTSTAMP:20260925T120000Z");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("rolls an all-day event over month and year ends", () => {
    const ics = buildIcs([{ uid: "x", title: "NYE", start: "2026-12-31" }], { now: NOW });
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("skips events with an unparseable start", () => {
    const ics = buildIcs([{ uid: "bad", title: "Bad", start: "not a date" }], { now: NOW });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
