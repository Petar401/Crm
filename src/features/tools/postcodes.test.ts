import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bulkLookupPostcodes,
  lookupPostcode,
  resetPostcodeMemo,
} from "./postcodes";

const raw = (postcode: string) => ({
  postcode,
  admin_district: "Norwich",
  admin_county: "Norfolk",
  region: "East of England",
  country: "England",
  admin_ward: "Mancroft",
  parliamentary_constituency: "Norwich South",
  latitude: 52.63,
  longitude: 1.29,
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetPostcodeMemo();
});

describe("lookupPostcode", () => {
  it("normalises, maps and memoises a hit", async () => {
    const fetchSpy = vi.fn<(url: string) => Promise<Response>>(async () =>
      Response.json({ status: 200, result: raw("NR1 3JB") })
    );
    vi.stubGlobal("fetch", fetchSpy);
    const first = await lookupPostcode("nr13jb");
    expect(first).toMatchObject({ status: "ok", info: { postcode: "NR1 3JB", county: "Norfolk" } });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.postcodes.io/postcodes/NR1%203JB");
    await lookupPostcode("NR1 3JB");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports not_found and unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect((await lookupPostcode("ZZ1 1ZZ")).status).toBe("not_found");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await lookupPostcode("ZZ1 1ZZ")).status).toBe("unavailable");
  });
});

describe("bulkLookupPostcodes", () => {
  it("dedupes, skips invalid input, batches by 100 and keys by normalised postcode", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const { postcodes } = JSON.parse(String(init?.body)) as { postcodes: string[] };
      return Response.json({
        status: 200,
        result: postcodes.map((q) => ({ query: q, result: q === "CB2 1AN" ? null : raw(q) })),
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const many = Array.from({ length: 150 }, (_, i) => `NR${(i % 30) + 1} ${i % 10}AB`);
    const found = await bulkLookupPostcodes([...many, "nr1 3jb", "NR13JB", "not a postcode", null, "CB2 1AN"]);

    const posted = fetchSpy.mock.calls.flatMap(
      ([, init]) => (JSON.parse(String(init?.body)) as { postcodes: string[] }).postcodes
    );
    expect(new Set(posted).size).toBe(posted.length); // no duplicates sent
    expect(fetchSpy.mock.calls.every(([, init]) => JSON.parse(String(init?.body)).postcodes.length <= 100)).toBe(true);
    expect(found.get("NR1 3JB")?.district).toBe("Norwich");
    expect(found.has("CB2 1AN")).toBe(false);
  });
});
