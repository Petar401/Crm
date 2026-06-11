import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/constants/permissions";
import { getAuthContext } from "@/lib/auth/session";

export interface PermissionSet {
  isFullAccess: boolean;
  isOwner: boolean;
  allowed: Set<PermissionKey>;
}

/**
 * Resolves the effective permission set for the current user in their active
 * workspace, following the brief's order:
 *   1. workspace_member loaded
 *   2. is_full_access => all standard permissions
 *   3. member_permission_overrides win for any key they specify
 *   4. otherwise fall back to the assigned role's permissions
 *   5. default deny
 * Ownership-only actions are gated separately via `isOwner`.
 * Cached per request.
 */
export const getPermissionSet = cache(async (): Promise<PermissionSet> => {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { isFullAccess: false, isOwner: false, allowed: new Set() };
  }

  const supabase = await createClient();
  const isOwner = ctx.workspace.created_by === ctx.userId;

  if (ctx.member.is_full_access) {
    return {
      isFullAccess: true,
      isOwner,
      allowed: new Set(PERMISSION_KEYS),
    };
  }

  const [{ data: overrides }, { data: rolePerms }] = await Promise.all([
    supabase
      .from("member_permission_overrides")
      .select("permission_key, allowed")
      .eq("workspace_member_id", ctx.member.id),
    ctx.member.role_id
      ? supabase
          .from("role_permissions")
          .select("permission_key, allowed")
          .eq("role_id", ctx.member.role_id)
      : Promise.resolve({ data: [] as { permission_key: string; allowed: boolean }[] }),
  ]);

  const overrideMap = new Map<string, boolean>(
    (overrides ?? []).map((o) => [o.permission_key, o.allowed])
  );
  const roleMap = new Map<string, boolean>(
    (rolePerms ?? []).map((r) => [r.permission_key, r.allowed])
  );

  const allowed = new Set<PermissionKey>();
  for (const key of PERMISSION_KEYS) {
    const resolved = overrideMap.has(key)
      ? overrideMap.get(key)!
      : (roleMap.get(key) ?? false);
    if (resolved) allowed.add(key);
  }

  return { isFullAccess: false, isOwner, allowed };
});

/** Whether the current user holds a permission in their active workspace. */
export async function can(key: PermissionKey): Promise<boolean> {
  const { allowed } = await getPermissionSet();
  return allowed.has(key);
}

/** Throws when the current user lacks the permission. Use in server actions. */
export async function requirePermission(key: PermissionKey): Promise<void> {
  if (!(await can(key))) {
    throw new Error(`Not authorized: missing permission "${key}".`);
  }
}
