import { formatMinor } from "@/lib/utils/format";
import type { QuoteBundle } from "@/features/quotes/queries";
import type { Workspace } from "@/lib/db/types";

interface RenderInput extends QuoteBundle {
  workspace: Pick<Workspace, "name" | "logo_url">;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

/**
 * Renders a quote to a self-contained HTML string. Used both for the
 * puppeteer PDF pipeline (page.setContent → page.pdf) and for the public
 * `/q/[token]` preview.
 */
export function renderQuoteHtml({
  workspace,
  quote,
  lines,
  company,
  contact,
}: RenderInput): string {
  const rows = lines
    .map(
      (l) => `
        <tr>
          <td>
            <div class="strong">${esc(l.description)}</div>
          </td>
          <td class="num">${esc(l.quantity)}</td>
          <td class="num">${esc(formatMinor(l.unit_price_minor, quote.currency))}</td>
          <td class="num">${l.discount_bps ? `${(l.discount_bps / 100).toFixed(2)}%` : "—"}</td>
          <td class="num">${l.tax_rate_bps ? `${(l.tax_rate_bps / 100).toFixed(2)}%` : "—"}</td>
          <td class="num strong">${esc(formatMinor(l.line_total_minor, quote.currency))}</td>
        </tr>`
    )
    .join("");

  const billTo = [
    contact?.full_name,
    company?.name,
    company?.address_line_1,
    [company?.postcode, company?.city].filter(Boolean).join(" "),
    company?.country,
  ]
    .filter(Boolean)
    .map((v) => `<div>${esc(v)}</div>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quote ${esc(quote.number)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font: 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Oxygen-Sans, sans-serif;
    color: #1c1c1c;
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 2px solid #111;
  }
  header .brand { font-size: 20px; font-weight: 700; }
  header .meta { text-align: right; font-size: 11px; color: #444; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .box { font-size: 11px; }
  .box .label { text-transform: uppercase; letter-spacing: .06em; font-size: 10px; color: #666; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 8px 6px; border-bottom: 1px solid #e6e6e6; text-align: left; vertical-align: top; }
  th { text-transform: uppercase; font-size: 10px; letter-spacing: .05em; background: #fafafa; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 600; }
  .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
  .totals table { width: 260px; }
  .totals td { border: none; padding: 4px 0; }
  .totals .grand td { border-top: 2px solid #111; font-weight: 700; font-size: 13px; padding-top: 8px; }
  .notes { margin-top: 40px; font-size: 11px; color: #333; white-space: pre-wrap; }
  .status {
    display: inline-block; padding: 4px 10px; border-radius: 999px;
    font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
  }
  .status.signed { background: #dcfce7; color: #166534; }
  .status.draft { background: #f3f4f6; color: #374151; }
  .status.sent { background: #dbeafe; color: #1e40af; }
  .status.void, .status.expired { background: #fee2e2; color: #991b1b; }
  .signed {
    margin-top: 40px; padding: 16px; border: 1px solid #dcfce7;
    background: #f0fdf4; border-radius: 8px; font-size: 11px;
  }
  .signed .who { font-weight: 600; margin-bottom: 4px; }
</style>
</head>
<body>
  <header>
    <div class="brand">${esc(workspace.name)}</div>
    <div class="meta">
      <div><strong>Quote</strong> ${esc(quote.number)}</div>
      ${quote.valid_until ? `<div>Valid until ${esc(formatDate(quote.valid_until))}</div>` : ""}
      <div class="status ${esc(quote.status)}">${esc(quote.status)}</div>
    </div>
  </header>

  <h1>Quote ${esc(quote.number)}</h1>

  <div class="grid">
    <div class="box">
      <div class="label">Bill to</div>
      ${billTo || "<div>—</div>"}
    </div>
    <div class="box">
      <div class="label">Details</div>
      <div>Issued ${esc(formatDate(quote.created_at))}</div>
      ${quote.sent_at ? `<div>Sent ${esc(formatDate(quote.sent_at))}</div>` : ""}
      <div>Currency ${esc(quote.currency)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit price</th>
        <th class="num">Discount</th>
        <th class="num">Tax</th>
        <th class="num">Line total</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6" style="color:#666">No lines yet</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td class="num">${esc(formatMinor(quote.subtotal_minor, quote.currency))}</td></tr>
      ${quote.discount_minor ? `<tr><td>Discount</td><td class="num">-${esc(formatMinor(quote.discount_minor, quote.currency))}</td></tr>` : ""}
      <tr><td>Tax</td><td class="num">${esc(formatMinor(quote.tax_minor, quote.currency))}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${esc(formatMinor(quote.total_minor, quote.currency))}</td></tr>
    </table>
  </div>

  ${
    quote.notes
      ? `<div class="notes"><div class="box label">Notes</div>${esc(quote.notes)}</div>`
      : ""
  }

  ${
    quote.status === "signed"
      ? `<div class="signed">
          <div class="who">Signed by ${esc(quote.signed_by_name)}</div>
          <div>${esc(quote.signed_by_email)} · ${esc(formatDate(quote.signed_at))}</div>
        </div>`
      : ""
  }
</body>
</html>`;
}
