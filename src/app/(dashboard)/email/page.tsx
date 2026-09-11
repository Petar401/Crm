import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getSentEmails, getContactEmailOptions } from "@/features/email/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { isEmailConfigured } from "@/features/email/settings-queries";
import { isAiConfigured } from "@/features/ai/settings-queries";
import {
  getAllAttachments,
  getAttachmentsByIds,
} from "@/features/attachments/queries";
import { getAllInvoices, getInvoicesByIds } from "@/features/invoices/queries";
import type { PickedAttachment } from "@/features/email/components/attachment-picker";
import { EmailTabs } from "@/features/email/components/email-tabs";
import { EmailNotConnected } from "@/features/email/components/email-not-connected";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ attach?: string; type?: string }>;
}) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();

  if (!allowed.has("email.view")) redirect("/");

  const configured = await isEmailConfigured(ctx.workspace.id);

  if (!configured) {
    return (
      <div>
        <PageHeader
          title="Email"
          description="Send and read mail from your business mailbox"
        />
        <EmailNotConnected canManage={allowed.has("settings.update")} />
      </div>
    );
  }

  const canAttachFiles = allowed.has("files.view");
  const canAttachInvoices = allowed.has("invoices.view");
  const aiEnabled = (await isAiConfigured(ctx.workspace.id)) && allowed.has("ai.use");

  const [sentEmails, contactOptions, companyOptions, attachmentOptions, invoiceOptions] =
    await Promise.all([
      getSentEmails(ctx.workspace.id),
      getContactEmailOptions(ctx.workspace.id),
      getCompanyOptions(ctx.workspace.id),
      canAttachFiles ? getAllAttachments(ctx.workspace.id) : Promise.resolve([]),
      canAttachInvoices ? getAllInvoices(ctx.workspace.id) : Promise.resolve([]),
    ]);

  // "Send via email" deep link from a Files/Invoices row: /email?attach=<id>&type=file|invoice
  const { attach, type } = await searchParams;
  const initialAttachments: PickedAttachment[] = [];
  if (attach && type === "file" && canAttachFiles) {
    const [match] = await getAttachmentsByIds(ctx.workspace.id, [attach]);
    if (match) {
      initialAttachments.push({ id: match.id, type: "file", name: match.file_name });
    }
  } else if (attach && type === "invoice" && canAttachInvoices) {
    const [match] = await getInvoicesByIds(ctx.workspace.id, [attach]);
    if (match) {
      initialAttachments.push({ id: match.id, type: "invoice", name: match.file_name });
    }
  }

  return (
    <div>
      <PageHeader
        title="Email"
        description="Send and read mail from your business mailbox"
      />
      <EmailTabs
        canSend={allowed.has("email.send")}
        sentEmails={sentEmails}
        contactOptions={contactOptions}
        companyOptions={companyOptions}
        attachmentOptions={attachmentOptions}
        invoiceOptions={invoiceOptions}
        initialAttachments={initialAttachments}
        aiEnabled={aiEnabled}
      />
    </div>
  );
}
