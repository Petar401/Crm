"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { composeEmailSchema, parseRecipients } from "@/features/email/schemas";
import { resolveEmailCredentials } from "@/features/email/settings-queries";
import { sendMail } from "@/features/email/transport";

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function sendEmail(values: unknown): Promise<ActionResult> {
  const parsed = composeEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("email.send");

  const creds = await resolveEmailCredentials(ctx.workspace.id);
  if (!creds) {
    return {
      error:
        "No mailbox is connected. Connect your business email in Settings before sending.",
    };
  }

  const to = parseRecipients(parsed.data.to);
  const cc = parseRecipients(parsed.data.cc);
  const bcc = parseRecipients(parsed.data.bcc);
  const contactId = parsed.data.contactId || null;
  const companyId = parsed.data.companyId || null;
  const dealId = parsed.data.dealId || null;

  const supabase = await createClient();

  let messageId: string | null = null;
  let sendError: string | null = null;
  try {
    const result = await sendMail(creds, {
      to,
      cc,
      bcc,
      subject: parsed.data.subject,
      text: parsed.data.body,
    });
    messageId = result.messageId;
  } catch (e) {
    sendError = e instanceof Error ? e.message : "Failed to send the email.";
  }

  const nowIso = new Date().toISOString();
  const { data: inserted } = await supabase
    .from("emails")
    .insert({
      workspace_id: ctx.workspace.id,
      direction: "outbound",
      message_id: messageId,
      subject: parsed.data.subject,
      from_email: creds.fromEmail,
      to_emails: to,
      cc_emails: cc,
      bcc_emails: bcc,
      body_text: parsed.data.body,
      status: sendError ? "failed" : "sent",
      error: sendError,
      company_id: companyId,
      contact_id: contactId,
      deal_id: dealId,
      created_by: ctx.userId,
      sent_at: sendError ? null : nowIso,
    })
    .select("id")
    .single<{ id: string }>();

  if (sendError) {
    return { error: sendError };
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "email",
    title: `Email sent: ${parsed.data.subject}`,
    detail: `To: ${to.join(", ")}`,
    contactId,
    companyId,
    dealId,
  });

  revalidatePath("/email");
  return { id: inserted?.id };
}
