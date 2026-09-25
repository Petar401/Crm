import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationKind } from "@/lib/db/types";

interface NotifyParams {
  workspaceId: string;
  userIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string;
  url?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string | null;
  /**
   * When true, use the admin client so a system emitter (cron, webhook) can
   * write across users regardless of the current auth context. Server actions
   * running under a user session should leave this false.
   */
  useAdmin?: boolean;
}

/**
 * Fan-out helper: writes one row per recipient into `notifications`.
 * Best-effort — never throws, so a failing insert never breaks the write path
 * that triggered it. Silently drops duplicate recipients.
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    const unique = Array.from(new Set(params.userIds.filter(Boolean)));
    if (unique.length === 0) return;

    const client = params.useAdmin ? createAdminClient() : await createClient();

    // Only members of the workspace may receive its notifications. Recipient
    // ids often come from client input (task assignee, record owner), so drop
    // anyone who isn't a member rather than trusting the caller.
    const { data: members } = await client
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", params.workspaceId)
      .in("user_id", unique);
    const memberIds = new Set(
      ((members ?? []) as { user_id: string }[]).map((m) => m.user_id)
    );
    const recipients = unique.filter((id) => memberIds.has(id));
    if (recipients.length === 0) return;

    // TODO: email digest support — read notification_preferences.email and
    // enqueue for delivery. Ships silently now while the transport is missing.
    const rows = recipients.map((userId) => ({
      workspace_id: params.workspaceId,
      user_id: userId,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      url: params.url ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      actor_user_id: params.actorUserId ?? null,
    }));

    await client.from("notifications").insert(rows);
  } catch {
    // Non-critical.
  }
}
