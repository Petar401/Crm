import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getBillingSettings,
  loadStripeSecret,
} from "@/features/stripe/settings";
import { stripeFor } from "@/features/stripe/client";
import type { BillingInvoice, Company } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Stripe Checkout session for a billing invoice. Returns
 * `{ url }` that the client redirects to.
 */
export async function POST(req: Request) {
  const ctx = await requireAuthContext();
  await requirePermission("billing.send");

  const { invoiceId } = (await req.json().catch(() => ({}))) as {
    invoiceId?: string;
  };
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  const settings = await getBillingSettings(ctx.workspace.id);
  if (!settings?.stripe_enabled) {
    return NextResponse.json(
      { error: "Stripe is not enabled for this workspace" },
      { status: 400 }
    );
  }
  const secret = await loadStripeSecret(ctx.workspace.id);
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<BillingInvoice>();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: company } = invoice.company_id
    ? await supabase
        .from("companies")
        .select("name, email")
        .eq("id", invoice.company_id)
        .maybeSingle<Pick<Company, "name" | "email">>()
    : { data: null };

  const stripe = stripeFor(secret);
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/billing/${invoice.id}?payment=success`,
    cancel_url: `${origin}/billing/${invoice.id}?payment=cancelled`,
    customer_email: company?.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: invoice.total_minor,
          product_data: {
            name: `Invoice ${invoice.number}`,
            description: company?.name ?? undefined,
          },
        },
      },
    ],
    metadata: {
      billing_invoice_id: invoice.id,
      workspace_id: ctx.workspace.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
