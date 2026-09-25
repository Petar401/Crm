import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseBasicClientAuth, verifyClientSecret } from "./client-auth";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

describe("verifyClientSecret", () => {
  it("lets public clients (no stored secret) through", () => {
    expect(verifyClientSecret(undefined, null)).toBe(true);
    expect(verifyClientSecret("anything", null)).toBe(true);
  });

  it("requires the right secret for confidential clients", () => {
    const stored = hash("crm_cs_secret");
    expect(verifyClientSecret("crm_cs_secret", stored)).toBe(true);
    expect(verifyClientSecret("wrong", stored)).toBe(false);
    expect(verifyClientSecret("", stored)).toBe(false);
    expect(verifyClientSecret(undefined, stored)).toBe(false);
  });
});

describe("parseBasicClientAuth", () => {
  it("decodes url-encoded id and secret", () => {
    const header = `Basic ${Buffer.from("my%20id:s%3Acret").toString("base64")}`;
    expect(parseBasicClientAuth(header)).toEqual({
      clientId: "my id",
      clientSecret: "s:cret",
    });
  });

  it("ignores other schemes and malformed values", () => {
    expect(parseBasicClientAuth("Bearer abc")).toBeNull();
    expect(parseBasicClientAuth(null)).toBeNull();
    expect(
      parseBasicClientAuth(`Basic ${Buffer.from("nocolon").toString("base64")}`)
    ).toBeNull();
  });
});
