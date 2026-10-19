import { formatMinor } from "@/lib/utils/format";
import type {
  BillingInvoice,
  BillingInvoiceLine,
  Company,
  Contact,
  Workspace,
} from "@/lib/db/types";

interface RenderInput {
  workspace: Pick<Workspace, "name" | "logo_url">;
  invoice: BillingInvoice;
  lines: BillingInvoiceLine[];
  company: Pick<Company, "name" | "address_line_1" | "city" | "postcode" | "country" | "email"> | null;
  contact: Pick<Contact, "full_name" | "email"> | null;
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

export function renderInvoiceHtml({
  workspace,
  invoice,
  lines,
  company,
  contact,
}: RenderInput): string {
  const rows = lines
    .map(
      (l) => `
        <tr>
          <td><div class="strong">${esc(l.description)}</div></td>
          <td class="num">${esc(l.quantity)}</td>
          <td class="num">${esc(formatMinor(l.unit_price_minor, invoice.currency))}</td>
          <td class="num">${l.tax_rate_bps ? `${(l.tax_rate_bps / 100).toFixed(2)}%` : "—"}</td>
          <td class="num strong">${esc(formatMinor(l.line_total_minor, invoice.currency))}</td>
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
<title>Invoice ${esc(invoice.number)}</title>
<style>
  body { font: 12px/1.5 -apple-system, sans-serif; color:#1c1c1c; padding:40px; max-width:900px; margin:0 auto; }
  header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:16px; border-bottom:2px solid #111; }
  header .brand { font-size:20px; font-weight:700; }
  header .meta { text-align:right; font-size:11px; color:#444; }
  h1 { font-size:28px; margin:0 0 8px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
  .box .label { text-transform:uppercase; letter-spacing:.06em; font-size:10px; color:#666; margin-bottom:6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { padding:8px 6px; border-bottom:1px solid #e6e6e6; text-align:left; vertical-align:top; }
  th { text-transform:uppercase; font-size:10px; letter-spacing:.05em; background:#fafafa; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .strong { font-weight:600; }
  .totals { margin-top:16px; display:flex; justify-content:flex-end; }
  .totals table { width:260px; }
  .totals td { border:none; padding:4px 0; }
  .totals .grand td { border-top:2px solid #111; font-weight:700; font-size:13px; padding-top:8px; }
  .status { display:inline-block; padding:4px 10px; border-radius:999px; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
  .status.paid { background:#dcfce7; color:#166534; }
  .status.open { background:#dbeafe; color:#1e40af; }
  .status.draft { background:#f3f4f6; color:#374151; }
  .status.void, .status.uncollectible { background:#fee2e2; color:#991b1b; }
  .memo { margin-top:32px; font-size:11px; white-space:pre-wrap; color:#333; }
</style>
</head>
<body>
  <header>
    <div class="brand">${esc(workspace.name)}</div>
    <div class="meta">
      <div><strong>Invoice</strong> ${esc(invoice.number)}</div>
      ${invoice.issued_at ? `<div>Issued ${esc(formatDate(invoice.issued_at))}</div>` : ""}
      ${invoice.due_date ? `<div>Due ${esc(formatDate(invoice.due_date))}</div>` : ""}
      <div class="status ${esc(invoice.status)}">${esc(invoice.status)}</div>
    </div>
  </header>

  <h1>Invoice ${esc(invoice.number)}</h1>

  <div class="grid">
    <div class="box">
      <div class="label">Bill to</div>
      ${billTo || "<div>—</div>"}
    </div>
    <div class="box">
      <div class="label">Payment</div>
      <div>Currency ${esc(invoice.currency)}</div>
      ${invoice.paid_at ? `<div>Paid ${esc(formatDate(invoice.paid_at))}</div>` : ""}
      ${invoice.external_ref ? `<div>Ref ${esc(invoice.external_ref)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit price</th>
        <th class="num">Tax</th>
        <th class="num">Line total</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5" style="color:#666">No lines</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td class="num">${esc(formatMinor(invoice.subtotal_minor, invoice.currency))}</td></tr>
      <tr><td>Tax</td><td class="num">${esc(formatMinor(invoice.tax_minor, invoice.currency))}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${esc(formatMinor(invoice.total_minor, invoice.currency))}</td></tr>
      ${invoice.amount_paid_minor ? `<tr><td>Paid</td><td class="num">${esc(formatMinor(invoice.amount_paid_minor, invoice.currency))}</td></tr>` : ""}
      ${invoice.amount_paid_minor && invoice.amount_paid_minor < invoice.total_minor ? `<tr><td>Balance</td><td class="num strong">${esc(formatMinor(invoice.total_minor - invoice.amount_paid_minor, invoice.currency))}</td></tr>` : ""}
    </table>
  </div>

  ${invoice.memo ? `<div class="memo"><div class="box label">Notes</div>${esc(invoice.memo)}</div>` : ""}
</body>
</html>`;
}
