import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/db/types";

export interface AuditLogRow extends AuditLog {
  actor: { full_name: string | null; email: string | null } | null;
}

export interface AuditLogFilters {
  actorUserId?: string;
  action?: string;
  since?: string;
  limit?: number;
}

export async function getAuditLogs(
  workspaceId: string,
  filters: AuditLogFilters = {}
): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_user_id_fkey(full_name, email)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.actorUserId) q = q.eq("actor_user_id", filters.actorUserId);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.since) q = q.gte("created_at", filters.since);

  const { data } = await q;
  return (data ?? []).map((row: AuditLog & { actor?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null }) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    return { ...row, actor: actor ?? null };
  }) as AuditLogRow[];
}
