import "server-only";

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * Decrypted mailbox credentials. `password` is the SMTP/IMAP app password
 * (decrypted just-in-time by resolveEmailCredentials); the login user is the
 * mailbox address. This shape is auth_type = 'basic'; the phase-2 OAuth path
 * will add an access-token variant here.
 */
export interface EmailCredentials {
  fromName: string | null;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  password: string;
}

export interface OutgoingMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface InboxMessage {
  uid: number;
  seq: number;
  seen: boolean;
  from: string;
  fromName: string | null;
  subject: string;
  date: string | null;
  snippet: string;
  text: string | null;
  html: string | null;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function buildTransport(creds: EmailCredentials) {
  return nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure,
    auth: { user: creds.fromEmail, pass: creds.password },
  });
}

function buildImapClient(creds: EmailCredentials) {
  return new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    auth: { user: creds.fromEmail, pass: creds.password },
    logger: false,
  });
}

/** Verifies both SMTP send and IMAP login. Returns a friendly error string. */
export async function verifyConnection(
  creds: EmailCredentials
): Promise<{ ok: boolean; error?: string }> {
  try {
    await buildTransport(creds).verify();
  } catch (e) {
    return { ok: false, error: `SMTP: ${errMessage(e)}` };
  }
  const client = buildImapClient(creds);
  try {
    await client.connect();
  } catch (e) {
    return { ok: false, error: `IMAP: ${errMessage(e)}` };
  } finally {
    await client.logout().catch(() => {});
  }
  return { ok: true };
}

/** Sends a message over SMTP. Throws on failure. */
export async function sendMail(
  creds: EmailCredentials,
  message: OutgoingMessage
): Promise<{ messageId: string | null }> {
  const info = await buildTransport(creds).sendMail({
    from: creds.fromName
      ? { name: creds.fromName, address: creds.fromEmail }
      : creds.fromEmail,
    to: message.to,
    cc: message.cc && message.cc.length ? message.cc : undefined,
    bcc: message.bcc && message.bcc.length ? message.bcc : undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { messageId: info.messageId ?? null };
}

/**
 * Fetches the latest inbox messages over IMAP and parses them. Bounded by
 * `limit`; always releases the mailbox lock and logs out. Returns newest first.
 */
export async function fetchInbox(
  creds: EmailCredentials,
  { limit = 25 }: { limit?: number } = {}
): Promise<InboxMessage[]> {
  const client = buildImapClient(creds);
  const messages: InboxMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total =
        typeof client.mailbox === "object" ? client.mailbox.exists : 0;
      if (!total) return [];
      const start = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        source: true,
      })) {
        const parsed = await simpleParser(msg.source as Buffer);
        const fromAddr = parsed.from?.value?.[0];
        const text = parsed.text ?? null;
        const date = parsed.date ?? msg.envelope?.date ?? null;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          seen: msg.flags?.has("\\Seen") ?? false,
          from: fromAddr?.address ?? "",
          fromName: fromAddr?.name || null,
          subject: parsed.subject ?? msg.envelope?.subject ?? "(no subject)",
          date: date ? new Date(date).toISOString() : null,
          snippet: (text ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
          text,
          html: typeof parsed.html === "string" ? parsed.html : null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  // fetch yields ascending sequence (oldest first); newest first for display.
  return messages.reverse();
}
