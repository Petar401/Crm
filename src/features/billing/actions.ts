"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { notify } from "@/features/notifications/emit";
import {
  invoiceHeaderSchema,
  recordPaymentSchema,
} from "@/features/billing/schemas";
import type { Quote, QuoteLine } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
}

function toMinor(v: string): number {
  return Math.round(parseFloat(v) * 100);
}

async function nextNumber(workspaceId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("next_billing_invoice_number", {
    p_workspace_id: workspaceId,
  });
  return (data as unknown as string) ?? `INV-${Date.now()}`;
}

export async function createInvoice(header: unknown): Promise<ActionResult> {
  const parsed = invoiceHeaderSchema.safeParse(header);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("billing.create");
  const supabase = await createClient();
  const number = await nextNumber(ctx.workspace.id);
  const { data, error } = await supabase
    .from("billing_invoices")
    .insert({
      workspace_id: ctx.workspace.id,
      number,
      deal_id: parsed.data.deal_id || null,
      quote_id: parsed.data.quote_id || null,
      company_id: parsed.data.company_id || null,
      contact_id: parsed.data.contact_id || null,
      currency: parsed.data.currency.toUpperCase(),
      due_date: parsed.data.due_date || null,
      memo: parsed.data.memo || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };
  revalidatePath("/billing");
  return { id: data.id };
}

/**
 * Copies a signed quote's lines onto a new billing invoice. Snapshots the
 * tax rate at the time of generation so a later rate change doesn't rewrite
 * historical invoices.
 */
export async function generateInvoiceFromQuote(
  quoteId: string
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("billing.create");
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Quote>();
  if (!quote) return { error: "Quote not found" };
  if (quote.status !== "signed") {
    return { error: "Only signed quotes can be invoiced" };
  }

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("*")
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });

  const number = await nextNumber(ctx.workspace.id);
  const { data: invoice, error } = await supabase
    .from("billing_invoices")
    .insert({
      workspace_id: ctx.workspace.id,
      number,
      deal_id: quote.deal_id,
      quote_id: quote.id,
      company_id: quote.company_id,
      contact_id: quote.contact_id,
      currency: quote.currency,
      subtotal_minor: quote.subtotal_minor,
      tax_minor: quote.tax_minor,
      discount_minor: quote.discount_minor,
      total_minor: quote.total_minor,
      status: "open",
      issued_at: new Date().toISOString(),
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  if (lines && lines.length > 0) {
    const rows = (lines as QuoteLine[]).map((l) => ({
      billing_invoice_id: invoice.id,
      product_id: l.product_id,
      position: l.position,
      description: l.description,
      quantity: l.quantity,
      unit_price_minor: l.unit_price_minor,
      discount_bps: l.discount_bps,
      tax_rate_id: l.tax_rate_id,
      tax_rate_bps: l.tax_rate_bps,
      line_subtotal_minor: l.line_subtotal_minor,
      line_tax_minor: l.line_tax_minor,
      line_total_minor: l.line_total_minor,
    }));
    await supabase.from("billing_invoice_lines").insert(rows);
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Invoice ${number} generated from quote ${quote.number}`,
    dealId: quote.deal_id,
    companyId: quote.company_id,
    contactId: quote.contact_id,
  });

  revalidatePath("/billing");
  return { id: invoice.id };
}

export async function updateInvoice(
  id: string,
  header: unknown
): Promise<ActionResult> {
  const parsed = invoiceHeaderSchema.safeParse(header);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("billing.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_invoices")
    .update({
      deal_id: parsed.data.deal_id || null,
      quote_id: parsed.data.quote_id || null,
      company_id: parsed.data.company_id || null,
      contact_id: parsed.data.contact_id || null,
      currency: parsed.data.currency.toUpperCase(),
      due_date: parsed.data.due_date || null,
      memo: parsed.data.memo || null,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/billing");
  revalidatePath(`/billing/${id}`);
  return { id };
}

export async function issueInvoice(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("billing.send");
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_invoices")
    .update({
      status: "open",
      issued_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "draft");
  if (error) return { error: error.message };
  revalidatePath(`/billing/${id}`);
  return { id };
}

export async function voidInvoice(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("billing.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_invoices")
    .update({ status: "void" })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/billing");
  revalidatePath(`/billing/${id}`);
  return { id };
}

export async function markUncollectible(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("billing.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_invoices")
    .update({ status: "uncollectible" })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath(`/billing/${id}`);
  return { id };
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("billing.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_invoices")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/billing");
  return {};
}

export async function recordPayment(
  invoiceId: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = recordPaymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("billing.update");
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("id, workspace_id, currency, total_minor, amount_paid_minor, created_by, number, status")
    .eq("id", invoiceId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      currency: string;
      total_minor: number;
      amount_paid_minor: number;
      created_by: string | null;
      number: string;
      status: string;
    }>();
  if (!invoice) return { error: "Invoice not found" };

  const amount = toMinor(parsed.data.amount);
  const { error: payErr } = await supabase.from("billing_payments").insert({
    billing_invoice_id: invoice.id,
    workspace_id: ctx.workspace.id,
    amount_minor: amount,
    currency: invoice.currency,
    method: parsed.data.method || null,
    external_ref: parsed.data.external_ref || null,
    paid_at: parsed.data.paid_at || new Date().toISOString(),
    note: parsed.data.note || null,
    recorded_by: ctx.userId,
  });
  if (payErr) return { error: payErr.message };

  const newPaid = invoice.amount_paid_minor + amount;
  const fullyPaid = newPaid >= invoice.total_minor;
  const { error: updErr } = await supabase
    .from("billing_invoices")
    .update({
      amount_paid_minor: newPaid,
      status: fullyPaid ? "paid" : invoice.status,
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq("id", invoice.id);
  if (updErr) return { error: updErr.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Payment recorded on ${invoice.number}`,
  });

  if (fullyPaid && invoice.created_by) {
    await notify({
      workspaceId: ctx.workspace.id,
      userIds: [invoice.created_by],
      kind: "invoice_paid",
      title: `Invoice ${invoice.number} paid`,
      url: `/billing/${invoice.id}`,
      entityType: "billing_invoice",
      entityId: invoice.id,
    });
  }

  revalidatePath(`/billing/${invoice.id}`);
  return { id: invoice.id };
}
