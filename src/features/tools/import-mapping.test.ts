import { describe, expect, it } from "vitest";

import { parseCsvRecords } from "@/lib/utils/csv";
import {
  contactNameParts,
  detectColumns,
  mapRecord,
  matchKey,
} from "./import-mapping";

describe("detectColumns", () => {
  it("maps common company headers", () => {
    const { headers } = parseCsvRecords("Company Name,Web Site,Town,Post Code,E-mail\n");
    expect(detectColumns("companies", headers)).toEqual({
      name: "company_name",
      city: "town",
      postcode: "post_code",
      email: "e_mail",
    });
  });

  it("maps contact headers including a single full-name column", () => {
    const { headers } = parseCsvRecords("Name,Organisation,Email Address,Job Title\n");
    expect(detectColumns("contacts", headers)).toEqual({
      full_name: "name",
      company: "organisation",
      email: "email_address",
      job_title: "job_title",
    });
  });
});

describe("mapRecord", () => {
  it("trims, drops empty values and caps long cells", () => {
    const out = mapRecord(
      { company: "  Acme  ", town: "", notes: "x".repeat(5000) },
      { name: "company", city: "town", industry: "notes" }
    );
    expect(out.name).toBe("Acme");
    expect(out.city).toBeUndefined();
    expect(out.industry).toHaveLength(2000);
  });
});

describe("contactNameParts", () => {
  it("prefers explicit first/last columns", () => {
    expect(contactNameParts({ first_name: "Jane", last_name: "Doe", full_name: "X Y" })).toEqual({
      first: "Jane",
      last: "Doe",
    });
  });

  it("splits a full name on the first space", () => {
    expect(contactNameParts({ full_name: "Mary Ann  Smith" })).toEqual({
      first: "Mary",
      last: "Ann Smith",
    });
    expect(contactNameParts({ full_name: "Cher" })).toEqual({ first: "Cher", last: "" });
  });
});

describe("matchKey", () => {
  it("ignores case and extra whitespace", () => {
    expect(matchKey("  Acme   Garden  Ltd ")).toBe("acme garden ltd");
    expect(matchKey(null)).toBe("");
  });
});
