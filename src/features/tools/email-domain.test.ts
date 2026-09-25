import { describe, expect, it } from "vitest";

import { checkEmailDomain, emailDomain, type DnsLike } from "./email-domain";

const err = (code: string) => Object.assign(new Error(code), { code });

function fakeDns(
  opts: {
    mx?: { exchange: string; priority: number }[] | string;
    a?: string[] | string;
    aaaa?: string[] | string;
  } = {}
): DnsLike {
  const answer = <T>(v: T | string | undefined, fallback: string) =>
    v === undefined
      ? Promise.reject(err(fallback))
      : typeof v === "string"
        ? Promise.reject(err(v))
        : Promise.resolve(v);
  return {
    resolveMx: () => answer(opts.mx, "ENODATA"),
    resolve4: () => answer(opts.a, "ENODATA"),
    resolve6: () => answer(opts.aaaa, "ENODATA"),
  };
}

describe("emailDomain", () => {
  it("extracts and normalises the domain", () => {
    expect(emailDomain("Jane@Example.CO.UK")).toBe("example.co.uk");
    expect(emailDomain("a@bücher.de")).toBe("xn--bcher-kva.de");
  });

  it("rejects malformed addresses and internal-looking names", () => {
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("a@localhost")).toBeNull();
    expect(emailDomain("a@-bad-.com")).toBeNull();
    expect(emailDomain("a b@example.com")).toBeNull();
    expect(emailDomain("a@example.123")).toBeNull();
  });
});

describe("checkEmailDomain", () => {
  it("is ok with MX records, sorted by preference", async () => {
    const res = await checkEmailDomain(
      "a@example.com",
      fakeDns({
        mx: [
          { exchange: "mx2.example.com", priority: 20 },
          { exchange: "mx1.example.com", priority: 10 },
        ],
      })
    );
    expect(res.status).toBe("ok");
    expect(res.mx).toEqual(["mx1.example.com", "mx2.example.com"]);
  });

  it("honours null MX (RFC 7505)", async () => {
    const res = await checkEmailDomain(
      "a@example.com",
      fakeDns({ mx: [{ exchange: "", priority: 0 }], a: ["93.184.216.34"] })
    );
    expect(res.status).toBe("no_mail");
  });

  it("falls back to an A record as implicit MX", async () => {
    const res = await checkEmailDomain("a@example.com", fakeDns({ a: ["93.184.216.34"] }));
    expect(res.status).toBe("ok");
    expect(res.mx).toEqual(["example.com"]);
  });

  it("is no_mail when the domain has neither MX nor address", async () => {
    const res = await checkEmailDomain("a@example.com", fakeDns());
    expect(res.status).toBe("no_mail");
  });

  it("is invalid when the domain does not exist", async () => {
    const res = await checkEmailDomain("a@nope.example", fakeDns({ mx: "ENOTFOUND" }));
    expect(res.status).toBe("invalid");
  });

  it("is unknown on DNS timeouts", async () => {
    expect((await checkEmailDomain("a@example.com", fakeDns({ mx: "ETIMEOUT" }))).status).toBe(
      "unknown"
    );
    expect(
      (await checkEmailDomain("a@example.com", fakeDns({ a: "ESERVFAIL" }))).status
    ).toBe("unknown");
  });

  it("is invalid for a malformed address without touching DNS", async () => {
    const res = await checkEmailDomain("not an email", fakeDns());
    expect(res).toMatchObject({ status: "invalid", domain: null });
  });
});
