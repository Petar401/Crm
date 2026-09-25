/**
 * Minimal RFC 5545 iCalendar builder for exporting tasks and deal close dates
 * to Google/Outlook/Apple Calendar. Dependency-free and pure.
 */

export interface IcsEvent {
  /** Stable, globally unique id (re-imports update instead of duplicating). */
  uid: string;
  title: string;
  description?: string | null;
  url?: string | null;
  /**
   * Timed event start (ISO timestamp), or an all-day date ("YYYY-MM-DD").
   * All-day events end the following day, per RFC 5545.
   */
  start: string;
  /** Timed events only; defaults to start + 30 minutes. */
  end?: string | null;
  /** Last modification time, used for DTSTAMP (defaults to now). */
  updatedAt?: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line at 75 octets (UTF-8), continuing with CRLF + space.
 * Never splits inside a multi-byte character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // First line may hold 75 octets; continuation lines hold 74 + the space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** 20260925T143000Z */
function utcStamp(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** 20260925 */
function dateStamp(date: string): string {
  return date.replace(/-/g, "");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isValidInstant(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/** Builds a VCALENDAR document. Events with an unparseable start are skipped. */
export function buildIcs(
  events: readonly IcsEvent[],
  options: { calendarName?: string; now?: Date } = {}
): string {
  const now = (options.now ?? new Date()).toISOString();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//Calendar export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(options.calendarName)}`);
  }

  for (const ev of events) {
    const allDay = DATE_ONLY.test(ev.start);
    if (!allDay && !isValidInstant(ev.start)) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(ev.uid)}`);
    const stamp =
      ev.updatedAt && isValidInstant(ev.updatedAt) ? ev.updatedAt : now;
    lines.push(`DTSTAMP:${utcStamp(stamp)}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(ev.start)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(nextDay(ev.start))}`);
    } else {
      const start = new Date(ev.start);
      const end =
        ev.end && isValidInstant(ev.end)
          ? new Date(ev.end)
          : new Date(start.getTime() + 30 * 60 * 1000);
      lines.push(`DTSTART:${utcStamp(start.toISOString())}`);
      lines.push(`DTEND:${utcStamp(end.toISOString())}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    if (ev.url) lines.push(`URL:${ev.url.replace(/[\r\n]/g, "")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
