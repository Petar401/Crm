import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  listPriceBooks,
  listTaxRates,
} from "@/features/products/queries";
import { PriceBooksEditor } from "@/features/products/components/price-books-editor";
import { TaxRatesEditor } from "@/features/products/components/tax-rates-editor";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function PricingSettingsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("products.view")) redirect("/");

  const [priceBooks, taxRates] = await Promise.all([
    listPriceBooks(ctx.workspace.id),
    listTaxRates(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Price books and tax rates for the CPQ and billing engine."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PriceBooksEditor
          priceBooks={priceBooks}
          canWrite={allowed.has("products.update")}
          canDelete={allowed.has("products.delete")}
        />
        <TaxRatesEditor
          taxRates={taxRates}
          canWrite={allowed.has("products.update")}
          canDelete={allowed.has("products.delete")}
        />
      </div>
    </div>
  );
}
