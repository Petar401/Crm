import { describe, expect, it } from "vitest";

import { buildVCard, buildVCards } from "./vcard";

describe("buildVCard", () => {
  it("builds a vCard 3.0 with escaped fields", () => {
    const card = buildVCard({
      uid: "c1",
      firstName: "Jane",
      lastName: "O'Neil",
      organization: "Acme, Ltd; Garden Division",
      title: "Head gardener",
      email: "jane@acme.test",
      phone: "+44 1223 000000",
      note: "Prefers mornings\nNo calls on Fridays",
    });
    expect(card).toContain("BEGIN:VCARD\r\nVERSION:3.0\r\n");
    expect(card).toContain("N:O'Neil;Jane;;;");
    expect(card).toContain("FN:Jane O'Neil");
    expect(card).toContain("ORG:Acme\\, Ltd\\; Garden Division");
    expect(card).toContain("EMAIL;TYPE=INTERNET:jane@acme.test");
    expect(card).toContain("TEL;TYPE=WORK,VOICE:+44 1223 000000");
    expect(card).toContain("NOTE:Prefers mornings\\nNo calls on Fridays");
    expect(card.trimEnd().endsWith("END:VCARD")).toBe(true);
  });

  it("omits empty optional fields and falls back to email for FN", () => {
    const card = buildVCard({ firstName: " ", email: "info@acme.test" });
    expect(card).toContain("FN:info@acme.test");
    expect(card).not.toContain("ORG:");
    expect(card).not.toContain("TEL");
  });

  it("concatenates several cards", () => {
    const vcf = buildVCards([{ firstName: "A" }, { firstName: "B" }]);
    expect(vcf.match(/BEGIN:VCARD/g)).toHaveLength(2);
  });
});
