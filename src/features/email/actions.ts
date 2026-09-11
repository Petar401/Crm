"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { composeEmailSchema, parseRecipients } from "@/features/email/schemas";
import { resolveEmailCredentials } from "@/features/email/settings-queries";
import { sendMail, type OutgoingAttachment } from "@/features/email/transport";
import { getAttachmentsByIds } from "@/features/attachments/queries";
import { getInvoicesByIds } from "@/features/invoices/queries";
import type { EmailAttachment } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
}

/** Combined size cap for everything attached to one outgoing email. */
const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Resolves the requested file/invoice ids into downloaded attachment buffers
 * plus the lightweight snapshot persisted on the `emails` row. Requires the
 * caller to have view access to whichever source(s) are referenced — a
 * separate check from `email.send`, since attaching a file effectively
 * exposes its contents to the recipient.
 */
async function resolveAttachments(
  workspaceId: string,
  attachmentIds: string[],
  invoiceIds: string[]
): Promise<{
  outgoing: OutgoingAttachment[];
  snapshot: EmailAttachment[];
  error?: string;
}> {
  const supabase = await createClient();
  const sources: { file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null }[] = [];

  if (attachmentIds.length > 0) {
    await requirePermission("files.view");
    sources.push(...(await getAttachmentsByIds(workspaceId, attachmentIds)));
  }
  if (invoiceIds.length > 0) {
    await requirePermission("invoices.view");
    sources.push(...(await getInvoicesByIds(workspaceId, invoiceIds)));
  }

  if (sources.length === 0) return { outgoing: [], snapshot: [] };

  const outgoing: OutgoingAttachment[] = [];
  const snapshot: EmailAttachment[] = [];
  let bytesSoFar = 0;

  for (const source of sources) {
    const { data, error } = await supabase.storage
      .from(source.storage_bucket)
      .download(source.storage_path);
    if (error || !data) {
      return { outgoing: [], snapshot: [], error: `Could not read ${source.file_name}.` };
    }
    bytesSoFar += data.size;
    if (bytesSoFar > MAX_TOTAL_ATTACHMENT_BYTES) {
      return {
        outgoing: [],
        snapshot: [],
        error: "Attachments are too large to send (15MB limit).",
      };
    }
    const content = Buffer.from(await data.arrayBuffer());
    outgoing.push({
      filename: source.file_name,
      content,
      contentType: source.mime_type ?? undefined,
    });
    snapshot.push({
      file_name: source.file_name,
      storage_bucket: source.storage_bucket,
      storage_path: source.storage_path,
    });
  }

  return { outgoing, snapshot };
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

  const {
    outgoing: outgoingAttachments,
    snapshot: attachmentSnapshot,
    error: attachmentError,
  } = await resolveAttachments(
    ctx.workspace.id,
    parsed.data.attachmentIds ?? [],
    parsed.data.invoiceIds ?? []
  );
  if (attachmentError) {
    return { error: attachmentError };
  }

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
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
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
      attachments: attachmentSnapshot,
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
