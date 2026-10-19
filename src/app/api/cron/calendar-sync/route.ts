import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccountOnce } from "@/features/calendar-sync/sync";
import type { CalendarAccount } from "@/lib/db/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Polls all connected calendar_accounts on a 15-minute schedule (see
 * vercel.json). Once we wire provider push subscriptions this cron falls
 * back to just refreshing about-to-expire tokens; for now it is the
 * primary sync path.
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
  const { data: accounts } = await admin
    .from("calendar_accounts")
    .select("*")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(50);

  const results: Array<{ id: string; synced: number; error?: string }> = [];
  for (const account of (accounts ?? []) as CalendarAccount[]) {
    const r = await syncAccountOnce(account);
    results.push({ id: account.id, synced: r.synced, error: r.error });
  }
  return NextResponse.json({ ran: results.length, results });
}

export const GET = handle;
export const POST = handle;
