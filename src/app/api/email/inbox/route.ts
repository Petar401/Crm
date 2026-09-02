import { NextResponse } from "next/server";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { resolveEmailCredentials } from "@/features/email/settings-queries";
import { fetchInbox } from "@/features/email/transport";

// Live IMAP fetch — kept off the page render path (latency + serverless
// limits) and loaded client-side by the Inbox tab. Session-authed.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("email.view")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const creds = await resolveEmailCredentials(ctx.workspace.id);
  if (!creds) {
    return NextResponse.json(
      { error: "No mailbox is connected for this workspace." },
      { status: 400 }
    );
  }

  try {
    const messages = await fetchInbox(creds, { limit: 25 });
    return NextResponse.json({ messages });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reach the mail server.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
