import { describe, expect, it } from "vitest";

import { buildQuery, escapeRegex, isValidBbox } from "./overpass";

describe("escapeRegex (Overpass category sanitiser)", () => {
  it("keeps ordinary category words", () => {
    expect(escapeRegex("  garden centre ")).toBe("garden centre");
    expect(escapeRegex("garden_centre")).toBe("garden_centre");
    expect(escapeRegex("B&B")).toBe("B&B");
    expect(escapeRegex("café")).toBe("café");
  });

  it("drops quotes and QL/regex syntax so a category can't break out", () => {
    const hostile = 'x"](1,1,1,1);out;(nwr["name"~".*';
    const safe = escapeRegex(hostile);
    expect(safe).not.toMatch(/["();\[\]~.*,]/);
  });

  it("drops control characters", () => {
    expect(escapeRegex("florist\n];out;")).toBe("floristout");
  });
});

describe("buildQuery", () => {
  it("returns null when nothing survives sanitising", () => {
    expect(buildQuery(['"();', "  "], "1,2,3,4", 10)).toBeNull();
  });

  it("embeds the sanitised pattern inside the quoted literal", () => {
    const q = buildQuery(['florist"]', "plumber"], "52.1,0.1,52.3,0.3", 10);
    expect(q).toContain('~"florist|plumber",i](52.1,0.1,52.3,0.3)');
  });
});

describe("isValidBbox", () => {
  it("accepts four numbers", () => {
    expect(isValidBbox("52.1,-0.5,52.3,0.3")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidBbox("52.1,-0.5,52.3")).toBe(false);
    expect(isValidBbox("52.1,-0.5,52.3,0.3);out;(")).toBe(false);
    expect(isValidBbox("a,b,c,d")).toBe(false);
  });
});
