/**
 * Dependency-free CSV helpers (RFC 4180) shared by the export route and the
 * import dialog. Safe to import from client and server code.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** UTF-8 byte-order mark, so Excel opens exports with the right encoding. */
export const CSV_BOM = "﻿";

/**
 * Cells a spreadsheet would evaluate as a formula (`=`, `+`, `-`, `@`, or a
 * leading tab/CR). CRM data is user-entered, so an exported value such as
 * `=HYPERLINK(...)` must not execute when the file is opened.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Escapes one cell: neutralises formulas, then quotes when needed. */
export function csvCell(value: unknown): string {
  let text = cellText(value);
  // Plain numbers (including negatives, e.g. "-12.5") are data, not formulas.
  const isNumber = text.trim() !== "" && Number.isFinite(Number(text));
  if (FORMULA_TRIGGER.test(text) && !isNumber) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialises rows to CSV with a header line, CRLF line endings and a BOM. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  }
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Parses CSV text into rows of cells. Handles quoted fields, escaped quotes,
 * embedded commas/newlines, CRLF or LF line endings, a leading BOM, and skips
 * blank lines.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(CSV_BOM) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      endRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/**
 * Parses CSV with a header row into objects keyed by the normalised header
 * (lower-case, spaces/dashes → underscores). Missing cells become "".
 */
export function parseCsvRecords(input: string): {
  headers: string[];
  records: Record<string, string>[];
} {
  const [head, ...body] = parseCsv(input);
  if (!head) return { headers: [], records: [] };
  const headers = head.map(normalizeHeader);
  const records = body.map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) rec[h] = (cells[idx] ?? "").trim();
    });
    return rec;
  });
  return { headers, records };
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
