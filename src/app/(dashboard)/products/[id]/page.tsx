import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getProduct, listTaxRates } from "@/features/products/queries";
import { ProductDetailActions } from "@/features/products/components/product-detail-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrencyPrecise, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("products.view")) redirect("/");

  const [product, taxRates] = await Promise.all([
    getProduct(ctx.workspace.id, id),
    listTaxRates(ctx.workspace.id),
  ]);
  if (!product) notFound();

  const taxRate = product.default_tax_rate_id
    ? taxRates.find((t) => t.id === product.default_tax_rate_id)
    : null;

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ArrowLeft className="size-4" />
            Back to products
          </Link>
        </Button>
      </div>
      <PageHeader
        title={product.name}
        description={product.description ?? ""}
        action={
          <ProductDetailActions
            product={product}
            taxRates={taxRates}
            canUpdate={allowed.has("products.update")}
            canDelete={allowed.has("products.delete")}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Default price">
              {formatCurrencyPrecise(product.default_price, product.default_currency)}
              <span className="text-muted-foreground ml-1 text-xs">
                /{product.unit}
              </span>
            </Row>
            <Row label="Currency">{product.default_currency}</Row>
            <Row label="Tax">
              {taxRate ? `${taxRate.name} (${(taxRate.rate_bps / 100).toFixed(2)}%)` : "—"}
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="SKU">
              <span className="font-mono text-xs">{product.sku ?? "—"}</span>
            </Row>
            <Row label="Kind">
              {product.kind === "recurring" ? (
                <Badge>Every {product.recurring_interval ?? "?"}</Badge>
              ) : (
                <Badge variant="secondary">One-time</Badge>
              )}
            </Row>
            <Row label="Status">
              {product.is_archived ? (
                <Badge variant="secondary">Archived</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
            </Row>
            <Row label="Created">{formatDate(product.created_at)}</Row>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
