import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT } from "@/lib/constants/list";
import type {
  BillingInvoice,
  BillingInvoiceLine,
  BillingPayment,
  Company,
  Deal,
} from "@/lib/db/types";

export interface InvoiceListItem extends BillingInvoice {
  company?: Pick<Company, "id" | "name"> | null;
  deal?: Pick<Deal, "id" | "name"> | null;
}

export async function listInvoices(
  workspaceId: string
): Promise<InvoiceListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_invoices")
    .select("*, company:companies(id,name), deal:deals(id,name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  return (data ?? []) as InvoiceListItem[];
}

export async function getInvoice(
  workspaceId: string,
  id: string
): Promise<BillingInvoice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<BillingInvoice>();
  return data;
}

export async function getInvoiceLines(
  invoiceId: string
): Promise<BillingInvoiceLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_invoice_lines")
    .select("*")
    .eq("billing_invoice_id", invoiceId)
    .order("position", { ascending: true });
  return (data ?? []) as BillingInvoiceLine[];
}

export async function listPayments(
  invoiceId: string
): Promise<BillingPayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("billing_invoice_id", invoiceId)
    .order("paid_at", { ascending: false });
  return (data ?? []) as BillingPayment[];
}

/**
 * VAT / tax report: totals per tax-rate bracket across `paid` and `open`
 * invoices in a date range. Backs `/billing/reports/vat`.
 */
export interface VatBracket {
  tax_rate_id: string | null;
  tax_rate_name: string;
  rate_bps: number;
  taxable_minor: number;
  tax_minor: number;
  currency: string;
}

export async function vatReport(
  workspaceId: string,
  fromISO: string,
  toISO: string
): Promise<VatBracket[]> {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("billing_invoices")
    .select("id, currency, status, issued_at")
    .eq("workspace_id", workspaceId)
    .gte("issued_at", fromISO)
    .lte("issued_at", toISO)
    .in("status", ["paid", "open"]);

  const invIds = (invoices ?? []).map((i) => i.id);
  if (invIds.length === 0) return [];

  const currencyByInvoice = new Map(
    (invoices ?? []).map((i) => [i.id, i.currency as string])
  );

  const { data: lines } = await supabase
    .from("billing_invoice_lines")
    .select("*, tax_rate:tax_rates(id, name, rate_bps)")
    .in("billing_invoice_id", invIds);

  const buckets = new Map<string, VatBracket>();
  for (const line of lines ?? []) {
    const t = (line as { tax_rate?: { id: string; name: string; rate_bps: number } | null }).tax_rate;
    const currency = currencyByInvoice.get(line.billing_invoice_id) ?? "GBP";
    const key = `${t?.id ?? "none"}:${currency}`;
    const existing = buckets.get(key) ?? {
      tax_rate_id: t?.id ?? null,
      tax_rate_name: t?.name ?? "Zero-rated / no tax",
      rate_bps: t?.rate_bps ?? 0,
      taxable_minor: 0,
      tax_minor: 0,
      currency,
    };
    existing.taxable_minor += line.line_subtotal_minor;
    existing.tax_minor += line.line_tax_minor;
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).sort(
    (a, b) => b.tax_minor - a.tax_minor
  );
}
