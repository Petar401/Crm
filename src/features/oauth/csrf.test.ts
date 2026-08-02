import { beforeAll, describe, expect, it } from "vitest";

import { mintOAuthCsrfToken, verifyOAuthCsrfToken } from "./csrf";

beforeAll(() => {
  // The helper needs a secret at HMAC time; vitest doesn't load .env.
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret-for-csrf-tokens";
});

describe("oauth csrf token", () => {
  it("round-trips for the same user", () => {
    const t = mintOAuthCsrfToken("user-1");
    expect(verifyOAuthCsrfToken(t, "user-1")).toBe(true);
  });

  it("fails when the user changes", () => {
    const t = mintOAuthCsrfToken("user-1");
    expect(verifyOAuthCsrfToken(t, "user-2")).toBe(false);
  });

  it("fails on missing / malformed token", () => {
    expect(verifyOAuthCsrfToken(undefined, "user-1")).toBe(false);
    expect(verifyOAuthCsrfToken("", "user-1")).toBe(false);
    expect(verifyOAuthCsrfToken("garbage", "user-1")).toBe(false);
    expect(verifyOAuthCsrfToken("123", "user-1")).toBe(false);
  });

  it("fails once expired", () => {
    const past = Date.now() - 60_000;
    const bad = `${past}.abc`;
    expect(verifyOAuthCsrfToken(bad, "user-1")).toBe(false);
  });

  it("fails when the signature is tampered", () => {
    const t = mintOAuthCsrfToken("user-1");
    const [exp, sig] = t.split(".");
    const flipped = sig.slice(0, -1) + (sig.slice(-1) === "0" ? "1" : "0");
    expect(verifyOAuthCsrfToken(`${exp}.${flipped}`, "user-1")).toBe(false);
  });
});
