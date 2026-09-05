import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getInvoice,
  getInvoiceLines,
  listPayments,
} from "@/features/billing/queries";
import { getBillingSettings } from "@/features/stripe/settings";
import { InvoiceDetailActions } from "@/features/billing/components/invoice-detail-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMinor } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.view")) redirect("/");

  const invoice = await getInvoice(ctx.workspace.id, id);
  if (!invoice) notFound();

  const [lines, payments, billingSettings] = await Promise.all([
    getInvoiceLines(invoice.id),
    listPayments(invoice.id),
    getBillingSettings(ctx.workspace.id),
  ]);
  const balance = Math.max(0, invoice.total_minor - invoice.amount_paid_minor);

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/billing">
            <ArrowLeft className="size-4" />
            Back to invoices
          </Link>
        </Button>
      </div>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={invoice.memo ?? undefined}
        action={
          <InvoiceDetailActions
            invoice={invoice}
            canUpdate={allowed.has("billing.update")}
            canSend={allowed.has("billing.send")}
            canDelete={allowed.has("billing.delete")}
            stripeEnabled={billingSettings?.stripe_enabled ?? false}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge className="capitalize">{invoice.status}</Badge>
        {invoice.issued_at && (
          <span className="text-muted-foreground">
            Issued {formatDate(invoice.issued_at)}
          </span>
        )}
        {invoice.due_date && (
          <span className="text-muted-foreground">
            Due {formatDate(invoice.due_date)}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No lines. Generate this invoice from a signed quote to copy
                lines automatically.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinor(l.unit_price_minor, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.tax_rate_bps
                          ? `${(l.tax_rate_bps / 100).toFixed(2)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMinor(l.line_total_minor, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row
                label="Subtotal"
                value={formatMinor(invoice.subtotal_minor, invoice.currency)}
              />
              <Row
                label="Tax"
                value={formatMinor(invoice.tax_minor, invoice.currency)}
              />
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMinor(invoice.total_minor, invoice.currency)}
                </span>
              </div>
              <Row
                label="Paid"
                value={formatMinor(invoice.amount_paid_minor, invoice.currency)}
              />
              <Row
                label="Balance"
                value={formatMinor(balance, invoice.currency)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No payments recorded yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between border-b pb-2 last:border-0"
                    >
                      <div>
                        <div className="font-medium tabular-nums">
                          {formatMinor(p.amount_minor, p.currency)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatDate(p.paid_at)} · {p.method ?? "manual"}
                        </div>
                      </div>
                      {p.external_ref && (
                        <span className="text-muted-foreground font-mono text-xs">
                          {p.external_ref}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
