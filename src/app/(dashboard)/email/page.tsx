import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getSentEmails, getContactEmailOptions } from "@/features/email/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { isEmailConfigured } from "@/features/email/settings-queries";
import { EmailTabs } from "@/features/email/components/email-tabs";
import { EmailNotConnected } from "@/features/email/components/email-not-connected";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
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

  const [sentEmails, contactOptions, companyOptions] = await Promise.all([
    getSentEmails(ctx.workspace.id),
    getContactEmailOptions(ctx.workspace.id),
    getCompanyOptions(ctx.workspace.id),
  ]);

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
      />
    </div>
  );
}
