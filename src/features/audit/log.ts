import { createClient } from "@/lib/supabase/server";

interface AuditLogParams {
  workspaceId: string;
  actorUserId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Records an admin action into `audit_logs`. Silent on failure — audit
 * logging must never break the write path it observes.
 *
 * Records here are the admin trail (settings, permissions, tokens, roles).
 * CRM-record activity goes to `activities` via `features/activities/log.ts`.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      workspace_id: params.workspaceId,
      actor_user_id: params.actorUserId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
    });
  } catch {
    // Non-critical.
  }
}
