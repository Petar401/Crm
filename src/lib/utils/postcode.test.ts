import { describe, expect, it } from "vitest";

import { isValidUkPostcode, normalizeUkPostcode } from "./postcode";

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
