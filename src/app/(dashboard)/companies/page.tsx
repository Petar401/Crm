import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getCompanies } from "@/features/companies/queries";
import { getMemberOptions } from "@/features/team/queries";
import { CompaniesTable } from "@/features/companies/components/companies-table";
import { ExportMenu } from "@/features/tools/components/export-menu";
import { ImportDialog } from "@/features/tools/components/import-dialog";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();

  if (!allowed.has("companies.view")) redirect("/");

  const [companies, members] = await Promise.all([
    getCompanies(ctx.workspace.id),
    getMemberOptions(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Organisations in your CRM"
        action={
          <div className="flex items-center gap-2">
            {allowed.has("companies.create") && <ImportDialog entity="companies" />}
            <ExportMenu entity="companies" />
          </div>
        }
      />
      <CompaniesTable
        companies={companies}
        members={members}
        canCreate={allowed.has("companies.create")}
        canUpdate={allowed.has("companies.update")}
        canDelete={allowed.has("companies.delete")}
      />
    </div>
  );
}
