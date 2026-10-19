import { redirect } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { listInvoices } from "@/features/billing/queries";
import { InvoicesTable } from "@/features/billing/components/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.view")) redirect("/");

  const invoices = await listInvoices(ctx.workspace.id);

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Invoices, payments and tax reporting."
        action={
          <Button asChild variant="outline">
            <Link href="/billing/reports/vat">
              <FileSpreadsheet className="size-4" />
              VAT report
            </Link>
          </Button>
        }
      />
      <InvoicesTable
        invoices={invoices}
        canCreate={allowed.has("billing.create")}
        canDelete={allowed.has("billing.delete")}
      />
    </div>
  );
}
