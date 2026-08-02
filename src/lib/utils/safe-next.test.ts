import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-next";

describe("safeInternalPath", () => {
  it("returns the path when it's a simple internal route", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/companies/abc")).toBe("/companies/abc");
  });

  it("falls back on an empty or missing next", () => {
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("//evil.com/path")).toBe("/");
  });

  it("rejects absolute URLs and userinfo tricks", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("http://evil.com")).toBe("/");
    // "next=@evil.com" style — must not slip through as an internal path.
    expect(safeInternalPath("@evil.com")).toBe("/");
  });

  it("rejects backslash tricks that browsers may normalize", () => {
    expect(safeInternalPath("/\\evil.com")).toBe("/");
    expect(safeInternalPath("/path\\evil.com")).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(safeInternalPath(undefined, "/reset-password")).toBe(
      "/reset-password"
    );
    expect(safeInternalPath("//evil.com", "/reset-password")).toBe(
      "/reset-password"
    );
  });
});
