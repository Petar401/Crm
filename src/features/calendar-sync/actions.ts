"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { syncAccountOnce } from "@/features/calendar-sync/sync";
import type { CalendarAccount } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  synced?: number;
}

export async function disconnectAccount(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("calendar.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/calendar");
  return {};
}

export async function syncNow(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("calendar.update");
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("calendar_accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle<CalendarAccount>();
  if (!account) return { error: "Not found" };
  const r = await syncAccountOnce(account);
  revalidatePath("/settings/calendar");
  revalidatePath("/calendar");
  return { synced: r.synced, error: r.error };
}
