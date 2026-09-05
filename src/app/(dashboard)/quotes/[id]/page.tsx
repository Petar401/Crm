import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getQuote, getQuoteLines } from "@/features/quotes/queries";
import { QuoteDetailActions } from "@/features/quotes/components/quote-detail-actions";
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

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("quotes.view")) redirect("/");

  const quote = await getQuote(ctx.workspace.id, id);
  if (!quote) notFound();
  const lines = await getQuoteLines(quote.id);

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/quotes">
            <ArrowLeft className="size-4" />
            Back to quotes
          </Link>
        </Button>
      </div>
      <PageHeader
        title={`Quote ${quote.number}`}
        description={quote.notes ?? undefined}
        action={
          <QuoteDetailActions
            quote={quote}
            canUpdate={allowed.has("quotes.update")}
            canSend={allowed.has("quotes.send")}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge className="capitalize">{quote.status}</Badge>
        <span className="text-muted-foreground">
          Created {formatDate(quote.created_at)}
        </span>
        {quote.valid_until && (
          <span className="text-muted-foreground">
            Valid until {formatDate(quote.valid_until)}
          </span>
        )}
        {quote.signed_at && quote.signed_by_name && (
          <span className="text-muted-foreground">
            Signed by {quote.signed_by_name} on {formatDate(quote.signed_at)}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Disc</TableHead>
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
                      {formatMinor(l.unit_price_minor, quote.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.discount_bps
                        ? `${(l.discount_bps / 100).toFixed(2)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.tax_rate_bps
                        ? `${(l.tax_rate_bps / 100).toFixed(2)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMinor(l.line_total_minor, quote.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Subtotal"
              value={formatMinor(quote.subtotal_minor, quote.currency)}
            />
            <Row
              label="Tax"
              value={formatMinor(quote.tax_minor, quote.currency)}
            />
            <div className="mt-3 flex justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMinor(quote.total_minor, quote.currency)}
              </span>
            </div>
          </CardContent>
        </Card>
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
