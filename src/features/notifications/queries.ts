import { createClient } from "@/lib/supabase/server";
import { getAuthContext, getUserId } from "@/lib/auth/session";
import type { Notification, NotificationPreference } from "@/lib/db/types";
import { NOTIFICATION_KINDS } from "@/features/notifications/kinds";

export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getRecentNotifications(limit = 20): Promise<Notification[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notification[];
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspace.id);

  const rows = (data ?? []) as NotificationPreference[];
  const map = new Map(rows.map((r) => [r.kind, r]));
  return NOTIFICATION_KINDS.map((kind) =>
    map.get(kind) ?? {
      user_id: ctx.userId,
      workspace_id: ctx.workspace.id,
      kind,
      in_app: true,
      email: false,
      updated_at: new Date().toISOString(),
    }
  );
}
