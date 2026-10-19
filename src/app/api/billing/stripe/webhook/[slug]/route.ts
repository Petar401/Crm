import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBillingSettingsByWebhookSlug,
  loadStripeSecret,
} from "@/features/stripe/settings";
import { stripeFor } from "@/features/stripe/client";
import { notify } from "@/features/notifications/emit";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-workspace webhook endpoint. The slug in the URL identifies the
 * workspace so we can look up the correct signing secret before verifying
 * the `Stripe-Signature` header. Idempotency via `stripe_events` unique
 * (workspace_id, external_id).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const settings = await getBillingSettingsByWebhookSlug(slug);
  if (!settings || !settings.stripe_enabled || !settings.webhook_secret) {
    return NextResponse.json({ error: "unknown endpoint" }, { status: 404 });
  }

  const secretKey = await loadStripeSecret(settings.workspace_id);
  if (!secretKey) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const stripe = stripeFor(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, settings.webhook_secret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Idempotency: insert first, and if we hit the unique constraint, we've
  // already processed this event.
  const { error: idempoErr } = await admin.from("stripe_events").insert({
    workspace_id: settings.workspace_id,
    external_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  if (idempoErr && !idempoErr.message.includes("duplicate")) {
    return NextResponse.json({ error: idempoErr.message }, { status: 500 });
  }
  if (idempoErr) {
    // Already processed.
    return NextResponse.json({ received: true, duplicate: true });
  }

  await handle(event, settings.workspace_id);

  await admin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("workspace_id", settings.workspace_id)
    .eq("external_id", event.id);

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event, workspaceId: string): Promise<void> {
  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.billing_invoice_id;
      if (!invoiceId) return;

      const paid = session.amount_total ?? 0;
      const currency = session.currency ?? "GBP";

      const { data: invoice } = await admin
        .from("billing_invoices")
        .select("id, total_minor, amount_paid_minor, created_by, number, status")
        .eq("id", invoiceId)
        .eq("workspace_id", workspaceId)
        .maybeSingle<{
          id: string;
          total_minor: number;
          amount_paid_minor: number;
          created_by: string | null;
          number: string;
          status: string;
        }>();
      if (!invoice) return;

      await admin.from("billing_payments").insert({
        billing_invoice_id: invoice.id,
        workspace_id: workspaceId,
        amount_minor: paid,
        currency: currency.toUpperCase(),
        method: "stripe",
        external_ref: session.id,
      });

      const nextPaid = invoice.amount_paid_minor + paid;
      const fullyPaid = nextPaid >= invoice.total_minor;
      await admin
        .from("billing_invoices")
        .update({
          amount_paid_minor: nextPaid,
          status: fullyPaid ? "paid" : invoice.status,
          paid_at: fullyPaid ? new Date().toISOString() : null,
          external_ref: session.id,
        })
        .eq("id", invoice.id);

      if (fullyPaid && invoice.created_by) {
        await notify({
          workspaceId,
          userIds: [invoice.created_by],
          kind: "invoice_paid",
          title: `Invoice ${invoice.number} paid via Stripe`,
          url: `/billing/${invoice.id}`,
          entityType: "billing_invoice",
          entityId: invoice.id,
          useAdmin: true,
        });
      }
      return;
    }
    case "invoice.payment_failed":
    case "customer.subscription.updated":
      // Recurring-subscription flows land in a later pass; the event is
      // logged in stripe_events regardless.
      return;
    default:
      return;
  }
}
