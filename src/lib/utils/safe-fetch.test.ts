import { describe, expect, it } from "vitest";

import { createGuardedLookup, safeFetchText } from "./safe-fetch";

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

describe("createGuardedLookup (connect-time DNS check)", () => {
  type Addr = { address: string; family: number };
  const resolverFor =
    (addresses: Addr[]) =>
    (_host: string, cb: (err: Error | null, a: Addr[]) => void) =>
      cb(null, addresses);

  function run(
    addresses: Addr[],
    all = false
  ): Promise<{ err: Error | null; result: unknown }> {
    const lookup = createGuardedLookup(resolverFor(addresses));
    return new Promise((resolve) => {
      lookup("rebind.example", { all }, (err, address, family) =>
        resolve({ err, result: all ? address : { address, family } })
      );
    });
  }

  it("refuses to connect when DNS answers with a private address", async () => {
    // A rebinding server can answer the pre-check with a public IP and the
    // socket's own lookup with an internal one — the latter must be refused.
    const { err } = await run([{ address: "169.254.169.254", family: 4 }]);
    expect(err?.message).toBe("Blocked address");
  });

  it("refuses when any returned address is private", async () => {
    const { err } = await run(
      [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ],
      true
    );
    expect(err).toBeTruthy();
  });

  it("refuses IPv4-mapped IPv6 loopback in hex form", async () => {
    const { err } = await run([{ address: "::ffff:7f00:1", family: 6 }]);
    expect(err).toBeTruthy();
  });

  it("passes public addresses through (single and all modes)", async () => {
    const single = await run([{ address: "93.184.216.34", family: 4 }]);
    expect(single.err).toBeNull();
    expect(single.result).toEqual({ address: "93.184.216.34", family: 4 });

    const all = await run([{ address: "2606:2800:220:1::1", family: 6 }], true);
    expect(all.err).toBeNull();
    expect(all.result).toEqual([{ address: "2606:2800:220:1::1", family: 6 }]);
  });
});
