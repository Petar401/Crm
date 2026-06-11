import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/lib/db/types";

interface LogActivityParams {
  workspaceId: string;
  actorUserId: string;
  type: ActivityType;
  title?: string;
  detail?: string;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  taskId?: string | null;
}

/** Inserts an activity timeline row. Best-effort: never throws. */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("activities").insert({
      workspace_id: params.workspaceId,
      actor_user_id: params.actorUserId,
      type: params.type,
      title: params.title ?? null,
      detail: params.detail ?? null,
      company_id: params.companyId ?? null,
      contact_id: params.contactId ?? null,
      deal_id: params.dealId ?? null,
      task_id: params.taskId ?? null,
    });
  } catch {
    // Activity logging is non-critical.
  }
}
