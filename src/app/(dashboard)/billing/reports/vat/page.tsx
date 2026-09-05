import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { vatReport } from "@/features/billing/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMinor } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface Search {
  from?: string;
  to?: string;
}

function defaultRange(): Search {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    .toISOString()
    .slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.view")) redirect("/");

  const raw = await searchParams;
  const { from, to } = { ...defaultRange(), ...raw };

  const brackets = await vatReport(
    ctx.workspace.id,
    `${from}T00:00:00Z`,
    `${to}T23:59:59Z`
  );

  const totalTaxByCurrency = brackets.reduce<Record<string, number>>((acc, b) => {
    acc[b.currency] = (acc[b.currency] ?? 0) + b.tax_minor;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/billing">
            <ArrowLeft className="size-4" />
            Back to billing
          </Link>
        </Button>
      </div>
      <PageHeader
        title="VAT / tax report"
        description={`Tax collected on paid and open invoices ${from} → ${to}.`}
        action={
          <Button asChild variant="outline">
            <a
              href={`/api/billing/reports/vat.xlsx?from=${from}&to=${to}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-4" />
              Download .xlsx
            </a>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-muted-foreground mb-1">From</div>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-muted-foreground mb-1">To</div>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded border px-2 py-1"
          />
        </label>
        <Button size="sm" type="submit">
          Recalculate
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tax rate</TableHead>
              <TableHead>Region / rate</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brackets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-6 text-center text-sm"
                >
                  No invoices in this range.
                </TableCell>
              </TableRow>
            ) : (
              brackets.map((b) => (
                <TableRow key={`${b.tax_rate_id ?? "none"}:${b.currency}`}>
                  <TableCell className="font-medium">{b.tax_rate_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(b.rate_bps / 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.currency}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(b.taxable_minor, b.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatMinor(b.tax_minor, b.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {Object.keys(totalTaxByCurrency).length > 0 && (
        <div className="mt-4 flex justify-end gap-6 text-sm">
          {Object.entries(totalTaxByCurrency).map(([currency, total]) => (
            <div key={currency}>
              <span className="text-muted-foreground mr-2">
                Total {currency}
              </span>
              <span className="tabular-nums font-semibold">
                {formatMinor(total, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
