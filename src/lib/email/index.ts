import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const from =
  process.env.RESEND_FROM_EMAIL ?? "CRM Notifications <notifications@example.com>";

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY || opts.to.length === 0) return;
  try {
    await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
  } catch {
    // fire-and-forget — never surface email errors to users
  }
}
