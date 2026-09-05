import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/features/notifications/emit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily dunning: for each workspace whose billing settings have
 * `send_dunning=true`, find open invoices whose (today - due_date) matches
 * one of the workspace's dunning_schedule_days and emit an
 * `invoice_overdue` notification. Actual email delivery is expected to
 * come from the notification transport layer.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const { data: settings } = await admin
    .from("workspace_billing_settings")
    .select("workspace_id, send_dunning, dunning_schedule_days")
    .eq("send_dunning", true);

  if (!settings || settings.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0 });
  }

  let sent = 0;
  for (const s of settings) {
    const { data: openInvoices } = await admin
      .from("billing_invoices")
      .select("id, workspace_id, number, due_date, created_by, total_minor, currency")
      .eq("workspace_id", s.workspace_id)
      .eq("status", "open")
      .not("due_date", "is", null);
    if (!openInvoices) continue;

    for (const inv of openInvoices) {
      if (!inv.due_date) continue;
      const due = new Date(inv.due_date);
      const overdue = Math.floor(
        (today.getTime() - due.getTime()) / 86400_000
      );
      if (overdue <= 0) continue;
      if (!(s.dunning_schedule_days as number[]).includes(overdue)) continue;
      if (!inv.created_by) continue;

      await notify({
        workspaceId: inv.workspace_id,
        userIds: [inv.created_by],
        kind: "invoice_overdue",
        title: `Invoice ${inv.number} is ${overdue} days overdue`,
        body: null as unknown as string,
        url: `/billing/${inv.id}`,
        entityType: "billing_invoice",
        entityId: inv.id,
        useAdmin: true,
      });
      sent += 1;
    }
  }

  return NextResponse.json({
    processed: settings.length,
    sent,
    date: todayIso,
  });
}

export const GET = handle;
export const POST = handle;
