import { describe, expect, it } from "vitest";

import { safeFetchText } from "./safe-fetch";

describe("safeFetchText SSRF guard", () => {
  it("rejects non-http(s) schemes", async () => {
    expect(await safeFetchText("file:///etc/passwd")).toBeNull();
    expect(await safeFetchText("ftp://example.com")).toBeNull();
    expect(await safeFetchText("javascript:alert(1)")).toBeNull();
  });

  it("rejects URLs with credentials", async () => {
    expect(await safeFetchText("https://user:pass@example.com")).toBeNull();
  });

  it("blocks direct IPv4 loopback and RFC1918 targets", async () => {
    expect(await safeFetchText("http://127.0.0.1/whatever")).toBeNull();
    expect(await safeFetchText("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(await safeFetchText("http://10.0.0.1/")).toBeNull();
    expect(await safeFetchText("http://192.168.1.1/")).toBeNull();
    expect(await safeFetchText("http://172.16.0.1/")).toBeNull();
    expect(await safeFetchText("http://100.64.1.1/")).toBeNull();
  });

  it("blocks direct IPv6 loopback, link-local and ULA", async () => {
    expect(await safeFetchText("http://[::1]/")).toBeNull();
    expect(await safeFetchText("http://[fe80::1]/")).toBeNull();
    expect(await safeFetchText("http://[fd00::1]/")).toBeNull();
  });

  it("rejects garbage URLs", async () => {
    expect(await safeFetchText("not-a-url")).toBeNull();
    expect(await safeFetchText("")).toBeNull();
  });
});
