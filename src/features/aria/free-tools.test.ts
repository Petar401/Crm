import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_TOOL_DEFINITIONS, runFreeTool } from "./free-tools";
import { resetBankHolidayMemo } from "@/features/tools/bank-holidays";
import { resetPostcodeMemo } from "@/features/tools/postcodes";

afterEach(() => {
  vi.unstubAllGlobals();
  resetBankHolidayMemo();
  resetPostcodeMemo();
});

describe("Aria free tools", () => {
  it("defines a handler for every advertised tool", async () => {
    // Keep the test offline: every external call fails fast.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    for (const def of FREE_TOOL_DEFINITIONS) {
      if (def.type !== "function") continue;
      // An empty-args call must return a string, never throw.
      expect(typeof (await runFreeTool(def.function.name, "{}"))).toBe("string");
    }
  });

  it("returns null for tools it doesn't own", async () => {
    expect(await runFreeTool("read_workspace_file", "{}")).toBeNull();
    expect(await runFreeTool("drop_tables", "{}")).toBeNull();
  });

  it("reports invalid JSON arguments instead of throwing", async () => {
    expect(await runFreeTool("lookup_uk_postcode", "{not json")).toMatch(/invalid arguments/);
  });

  it("rejects a malformed postcode without calling the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await runFreeTool("lookup_uk_postcode", '{"postcode":"../../admin"}')).toMatch(
      /valid UK postcode/
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps a postcodes.io response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: 200,
          result: {
            postcode: "CB2 1AN",
            admin_district: "Cambridge",
            admin_county: "Cambridgeshire",
            region: "East of England",
            country: "England",
            admin_ward: "Market",
            parliamentary_constituency: "Cambridge",
            latitude: 52.2,
            longitude: 0.12,
          },
        })
      )
    );
    const out = JSON.parse((await runFreeTool("lookup_uk_postcode", '{"postcode":"cb21an"}'))!);
    expect(out).toMatchObject({ postcode: "CB2 1AN", district: "Cambridge", nation: "England" });
  });

  it("answers whether a date is a bank holiday", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          "england-and-wales": {
            events: [{ title: "Christmas Day", date: "2026-12-25", notes: "" }],
          },
        })
      )
    );
    const out = JSON.parse((await runFreeTool("uk_bank_holidays", '{"date":"2026-12-25"}'))!);
    expect(out).toMatchObject({ isBankHoliday: true, holiday: { title: "Christmas Day" } });
  });

  it("memoises the holiday feed so repeat calls don't refetch", async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({ "england-and-wales": { events: [] } })
    );
    vi.stubGlobal("fetch", fetchSpy);
    await runFreeTool("uk_bank_holidays", "{}");
    await runFreeTool("uk_bank_holidays", "{}");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when GOV.UK is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await runFreeTool("uk_bank_holidays", "{}")).toMatch(/unavailable/);
  });
});
