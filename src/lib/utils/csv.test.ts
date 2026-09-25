import { describe, expect, it } from "vitest";

import {
  CSV_BOM,
  csvCell,
  decodeCsvBytes,
  parseCsv,
  parseCsvRecords,
  toCsv,
  unguardCsvCell,
} from "./csv";

describe("csvCell", () => {
  it("quotes cells with commas, quotes or newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
  });

  it("leaves phone numbers alone", () => {
    expect(csvCell("+44 20 7946 0000")).toBe("+44 20 7946 0000");
    expect(csvCell("(01603) 123-456")).toBe("(01603) 123-456");
  });

  it("round-trips guarded cells through unguardCsvCell", () => {
    expect(unguardCsvCell(csvCell("=HYPERLINK(1)"))).toBe("=HYPERLINK(1)");
    expect(unguardCsvCell("'plain quote")).toBe("'plain quote");
  });

  it("leaves numbers alone", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell("-3")).toBe("-3");
    expect(csvCell(0)).toBe("0");
  });

  it("renders null/undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv / parseCsv round trip", () => {
  const rows = [
    { name: "Acme, Ltd", notes: 'He said "yes"\nthen left', value: 1200 },
    { name: "Émile & Co", notes: "", value: null },
  ];
  const csv = toCsv(rows, [
    { header: "Name", value: (r) => r.name },
    { header: "Notes", value: (r) => r.notes },
    { header: "Value", value: (r) => r.value },
  ]);

  it("starts with a BOM and uses CRLF", () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("parses back to the same cells", () => {
    expect(parseCsv(csv)).toEqual([
      ["Name", "Notes", "Value"],
      ["Acme, Ltd", 'He said "yes"\nthen left', "1200"],
      ["Émile & Co", "", ""],
    ]);
  });
});

describe("parseCsv", () => {
  it("handles LF endings, blank lines and a trailing line without newline", () => {
    expect(parseCsv("a,b\n\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("keeps empty trailing cells", () => {
    expect(parseCsv("a,b,c\r\n1,,\r\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("normalises headers and trims values", () => {
    const { headers, records } = parseCsvRecords(
      "Company Name,E-mail , Phone\nAcme , a@acme.test,  01223\n"
    );
    expect(headers).toEqual(["company_name", "e_mail", "phone"]);
    expect(records).toEqual([
      { company_name: "Acme", e_mail: "a@acme.test", phone: "01223" },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsvRecords("")).toEqual({ headers: [], records: [] });
  });
});

describe("decodeCsvBytes", () => {
  it("reads UTF-8", () => {
    const bytes = new TextEncoder().encode("Name\nCafé £5\n");
    expect(decodeCsvBytes(bytes)).toBe("Name\nCafé £5\n");
  });

  it("falls back to Windows-1252 for Excel's default CSV", () => {
    // "Café £5" in Windows-1252: é = 0xE9, £ = 0xA3.
    const bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0xa3, 0x35]);
    expect(decodeCsvBytes(bytes)).toBe("Café £5");
  });
});
