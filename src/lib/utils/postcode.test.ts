import { describe, expect, it } from "vitest";

import {
  addressFillFromPostcode,
  isValidUkPostcode,
  normalizeUkPostcode,
} from "./postcode";

describe("normalizeUkPostcode", () => {
  it("formats every UK postcode shape", () => {
    expect(normalizeUkPostcode("cb21an")).toBe("CB2 1AN");
    expect(normalizeUkPostcode(" nr1  3jb ")).toBe("NR1 3JB");
    expect(normalizeUkPostcode("M11AE")).toBe("M1 1AE");
    expect(normalizeUkPostcode("b338th")).toBe("B33 8TH");
    expect(normalizeUkPostcode("W1A0AX")).toBe("W1A 0AX");
    expect(normalizeUkPostcode("EC1A1BB")).toBe("EC1A 1BB");
    expect(normalizeUkPostcode("gir0aa")).toBe("GIR 0AA");
  });

  it("rejects non-UK or malformed input", () => {
    expect(normalizeUkPostcode("12345")).toBeNull();
    expect(normalizeUkPostcode("SW1A 1A")).toBeNull();
    expect(normalizeUkPostcode("../../etc")).toBeNull();
    expect(normalizeUkPostcode("")).toBeNull();
    expect(normalizeUkPostcode(null)).toBeNull();
    expect(isValidUkPostcode("CB2 1AN")).toBe(true);
    expect(isValidUkPostcode("CB2 1AN; DROP")).toBe(false);
  });
});

describe("addressFillFromPostcode", () => {
  const place = { district: "Broadland", county: "Norfolk" };

  it("fills only empty fields", () => {
    expect(addressFillFromPostcode(place, { city: "Aylsham", country: "" })).toEqual({
      country: "United Kingdom",
    });
    expect(addressFillFromPostcode(place, { city: "", county: "", country: "UK" })).toEqual({
      city: "Broadland",
      county: "Norfolk",
    });
  });

  it("uses the district as county for unitary authorities, never the nation", () => {
    expect(
      addressFillFromPostcode({ district: "Peterborough", county: null }, { county: "" })
    ).toMatchObject({ county: "Peterborough" });
  });

  it("doesn't touch county when the form has no county field", () => {
    expect(addressFillFromPostcode(place, { city: "" })).toEqual({
      city: "Broadland",
      country: "United Kingdom",
    });
  });
});
