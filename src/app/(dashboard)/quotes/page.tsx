import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { listQuotes } from "@/features/quotes/queries";
import { QuotesTable } from "@/features/quotes/components/quotes-table";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("quotes.view")) redirect("/");

  const quotes = await listQuotes(ctx.workspace.id);

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Priced proposals — send, get signed, invoice."
      />
      <QuotesTable
        quotes={quotes}
        canCreate={allowed.has("quotes.create")}
        canDelete={allowed.has("quotes.delete")}
      />
    </div>
  );
}
