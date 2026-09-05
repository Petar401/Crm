"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { NOTIFICATION_KINDS } from "@/features/notifications/kinds";

export interface ActionResult {
  error?: string;
}

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", ctx.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

const prefSchema = z.object({
  kind: z.enum(NOTIFICATION_KINDS as [string, ...string[]]),
  in_app: z.boolean(),
  email: z.boolean(),
});

export async function updateNotificationPreference(
  values: unknown
): Promise<ActionResult> {
  const parsed = prefSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: ctx.userId,
    workspace_id: ctx.workspace.id,
    kind: parsed.data.kind,
    in_app: parsed.data.in_app,
    email: parsed.data.email,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
