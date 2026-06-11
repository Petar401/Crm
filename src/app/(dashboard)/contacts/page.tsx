import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getContacts, getCompanyOptions } from "@/features/contacts/queries";
import { ContactsTable } from "@/features/contacts/components/contacts-table";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("contacts.view")) redirect("/");

  const [contacts, companies] = await Promise.all([
    getContacts(ctx.workspace.id),
    getCompanyOptions(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader title="Contacts" description="People in your CRM" />
      <ContactsTable
        contacts={contacts}
        companies={companies}
        canCreate={allowed.has("contacts.create")}
        canUpdate={allowed.has("contacts.update")}
        canDelete={allowed.has("contacts.delete")}
      />
    </div>
  );
}
