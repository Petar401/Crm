import "server-only";

import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";

/**
 * Checks whether an email address's domain can receive mail, using the
 * server's own DNS (no external API): MX records, falling back to A/AAAA as
 * the implicit MX (RFC 5321 §5.1), and honouring "null MX" (RFC 7505). It
 * proves the domain accepts mail, not that the mailbox exists.
 */
export type EmailDomainStatus =
  | "ok" // domain publishes MX (or an implicit A/AAAA fallback)
  | "no_mail" // domain exists but explicitly accepts no mail / has no host
  | "invalid" // malformed address or domain does not exist
  | "unknown"; // DNS timed out or failed — try again later

export interface EmailDomainResult {
  status: EmailDomainStatus;
  domain: string | null;
  /** Mail hosts, lowest preference first (empty unless status is "ok"). */
  mx: string[];
  message: string;
}

export interface DnsLike {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

const MESSAGES: Record<EmailDomainStatus, string> = {
  ok: "This domain accepts email.",
  no_mail: "This domain doesn't accept email.",
  invalid: "This email address or its domain doesn't exist.",
  unknown: "Couldn't check the domain right now. Try again later.",
};

function result(
  status: EmailDomainStatus,
  domain: string | null,
  mx: string[] = []
): EmailDomainResult {
  return { status, domain, mx, message: MESSAGES[status] };
}

/**
 * Extracts and validates the domain part. Converts IDNs to punycode and
 * requires a real-looking public name (at least one dot, alphabetic TLD).
 */
export function emailDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  if (/\s/.test(trimmed)) return null;
  const ascii = domainToASCII(trimmed.slice(at + 1).replace(/\.$/, "").toLowerCase());
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split(".");
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return null;
  const labelOk = (l: string) =>
    l.length >= 1 && l.length <= 63 && /^[a-z0-9-]+$/.test(l) && !l.startsWith("-") && !l.endsWith("-");
  return labels.every(labelOk) ? ascii : null;
}

function code(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

/** DNS error codes meaning "the record/name really isn't there". */
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function defaultResolver(): DnsLike {
  const resolver = new Resolver({ timeout: 4000, tries: 1 });
  return resolver;
}

export async function checkEmailDomain(
  email: string,
  dns: DnsLike = defaultResolver()
): Promise<EmailDomainResult> {
  const domain = emailDomain(email);
  if (!domain) return result("invalid", null);

  try {
    const records = await dns.resolveMx(domain);
    // RFC 7505 null MX: a single record with an empty exchange ("." on the wire).
    const hosts = records
      .filter((r) => r.exchange && r.exchange !== ".")
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange);
    if (hosts.length > 0) return result("ok", domain, hosts);
    if (records.length > 0) return result("no_mail", domain);
  } catch (err) {
    if (code(err) === "ENOTFOUND" || code(err) === "NXDOMAIN") {
      return result("invalid", domain);
    }
    if (!NOT_FOUND.has(code(err) ?? "")) return result("unknown", domain);
  }

  // No MX: the domain's own A/AAAA record acts as the implicit mail host.
  const [v4, v6] = await Promise.allSettled([
    dns.resolve4(domain),
    dns.resolve6(domain),
  ]);
  const hasAddress = [v4, v6].some(
    (r) => r.status === "fulfilled" && r.value.length > 0
  );
  if (hasAddress) return result("ok", domain, [domain]);

  const errors = [v4, v6]
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => code(r.reason) ?? "");
  if (errors.some((c) => !NOT_FOUND.has(c))) return result("unknown", domain);
  return result("no_mail", domain);
}
