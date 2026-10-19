import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getDeals } from "@/features/deals/queries";
import { getCompanies } from "@/features/companies/queries";
import { getContacts } from "@/features/contacts/queries";
import { listProducts, listTaxRates } from "@/features/products/queries";
import { QuoteEditor } from "@/features/quotes/components/quote-editor";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("quotes.create")) redirect("/quotes");

  const [deals, companies, contacts, products, taxRates] = await Promise.all([
    getDeals(ctx.workspace.id),
    getCompanies(ctx.workspace.id),
    getContacts(ctx.workspace.id),
    listProducts(ctx.workspace.id),
    listTaxRates(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader title="New quote" description="Draft a priced proposal." />
      <QuoteEditor
        deals={deals.map((d) => ({
          id: d.id,
          name: d.name,
          company_id: d.company_id,
          primary_contact_id: d.primary_contact_id,
          currency: d.currency,
        }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          full_name: c.full_name,
          company_id: c.company_id,
        }))}
        products={products}
        taxRates={taxRates}
      />
    </div>
  );
}
