import { notFound } from "next/navigation";

import { resolveShareToken } from "@/features/quotes/queries";
import { QuoteSignForm } from "@/features/quotes/components/quote-sign-form";
import { Button } from "@/components/ui/button";
import { formatDate, formatMinor } from "@/lib/utils/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await resolveShareToken(token);
  if (!bundle) notFound();
  const { quote, lines, company, contact } = bundle;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quote {quote.number}</h1>
          {quote.valid_until && (
            <p className="text-muted-foreground text-sm">
              Valid until {formatDate(quote.valid_until)}
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <a
            href={`/api/quotes/${quote.id}/pdf?token=${encodeURIComponent(token)}`}
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
        </Button>
      </div>

      {(company || contact) && (
        <div className="mb-6 rounded-lg border p-4 text-sm">
          {contact?.full_name && <div>{contact.full_name}</div>}
          {company?.name && <div className="font-medium">{company.name}</div>}
          {company?.address_line_1 && <div>{company.address_line_1}</div>}
          <div className="text-muted-foreground">
            {[company?.postcode, company?.city, company?.country]
              .filter(Boolean)
              .join(", ")}
          </div>
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Unit</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.description}</td>
                <td className="p-3 text-right tabular-nums">{l.quantity}</td>
                <td className="p-3 text-right tabular-nums">
                  {formatMinor(l.unit_price_minor, quote.currency)}
                </td>
                <td className="p-3 text-right font-medium tabular-nums">
                  {formatMinor(l.line_total_minor, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <Row
            label="Subtotal"
            value={formatMinor(quote.subtotal_minor, quote.currency)}
          />
          <Row
            label="Tax"
            value={formatMinor(quote.tax_minor, quote.currency)}
          />
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatMinor(quote.total_minor, quote.currency)}
            </span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="mb-6 whitespace-pre-wrap rounded-lg border bg-yellow-50 p-4 text-sm">
          {quote.notes}
        </div>
      )}

      {quote.status === "signed" ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Signed by {quote.signed_by_name} on {formatDate(quote.signed_at)}.
        </div>
      ) : quote.status === "void" || quote.status === "expired" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This quote is no longer active.
        </div>
      ) : (
        <QuoteSignForm token={token} quoteNumber={quote.number} />
      )}
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
