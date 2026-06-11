import { createClient } from "@/lib/supabase/server";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/constants/permissions";
import type { WorkspaceMember } from "@/lib/db/types";

export interface MemberPermissionState {
  isFullAccess: boolean;
  /** Effective allow/deny per permission key (override → role → default deny). */
  effective: Record<string, boolean>;
}

/**
 * Resolves the editable permission state for a member: their full-access flag
 * and the effective per-key values (member overrides win over role defaults).
 */
export async function getMemberPermissionState(
  workspaceId: string,
  memberId: string
): Promise<MemberPermissionState | null> {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceMember>();

  if (!member) return null;

  const [{ data: overrides }, { data: rolePerms }] = await Promise.all([
    supabase
      .from("member_permission_overrides")
      .select("permission_key, allowed")
      .eq("workspace_member_id", memberId),
    member.role_id
      ? supabase
          .from("role_permissions")
          .select("permission_key, allowed")
          .eq("role_id", member.role_id)
      : Promise.resolve({
          data: [] as { permission_key: string; allowed: boolean }[],
        }),
  ]);

  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.permission_key, o.allowed])
  );
  const roleMap = new Map(
    (rolePerms ?? []).map((r) => [r.permission_key, r.allowed])
  );

  const effective: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    effective[key] = overrideMap.has(key)
      ? overrideMap.get(key)!
      : (roleMap.get(key) ?? false);
  }

  return { isFullAccess: member.is_full_access, effective };
}

export type { PermissionKey };
