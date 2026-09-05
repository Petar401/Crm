import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getCompanies } from "@/features/companies/queries";
import { getDeals } from "@/features/deals/queries";
import { NewInvoiceForm } from "@/features/billing/components/new-invoice-form";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.create")) redirect("/billing");

  const [companies, deals] = await Promise.all([
    getCompanies(ctx.workspace.id),
    getDeals(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="New invoice"
        description="Create an empty draft; add lines on the detail page."
      />
      <NewInvoiceForm
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        deals={deals.map((d) => ({
          id: d.id,
          name: d.name,
          company_id: d.company_id,
        }))}
      />
    </div>
  );
}
