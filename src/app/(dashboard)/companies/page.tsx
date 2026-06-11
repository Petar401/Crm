import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getCompanies } from "@/features/companies/queries";
import { CompaniesTable } from "@/features/companies/components/companies-table";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();

  if (!allowed.has("companies.view")) redirect("/");

  const companies = await getCompanies(ctx.workspace.id);

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Organisations in your CRM"
      />
      <CompaniesTable
        companies={companies}
        canCreate={allowed.has("companies.create")}
        canUpdate={allowed.has("companies.update")}
        canDelete={allowed.has("companies.delete")}
      />
    </div>
  );
}
