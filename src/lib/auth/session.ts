import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Workspace, WorkspaceMember } from "@/lib/db/types";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export interface AuthContext {
  userId: string;
  email: string;
  profile: Profile | null;
  workspace: Workspace;
  member: WorkspaceMember;
}

/**
 * When set, `getAuthContext` returns this instead of reading the cookie
 * session, and `createClient()` returns a service-role client. Used by the
 * MCP route to run existing server actions/queries under a bearer-token
 * identity. Set via `runWithAuthOverride`.
 */
export interface AuthOverride {
  ctx: AuthContext;
  useServiceRole: true;
}

const overrideStore = new AsyncLocalStorage<AuthOverride>();

export function getAuthOverride(): AuthOverride | undefined {
  return overrideStore.getStore();
}

export function runWithAuthOverride<T>(
  ctx: AuthContext,
  fn: () => Promise<T>
): Promise<T> {
  return overrideStore.run({ ctx, useServiceRole: true }, fn);
}

/** The authenticated auth.users id, or null. Cached per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const override = getAuthOverride();
  if (override) return override.ctx.userId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

/**
 * Loads the full auth context for a given user id. Used by both the cookie
 * path and the bearer-token path; performs the workspace/profile joins the
 * app needs.
 *
 * The caller supplies the Supabase client to run the reads against. The
 * cookie path passes its cookie-bound anon client (RLS scopes the reads to
 * the current user); the MCP token path passes the admin client because
 * there is no cookie session.
 */
export async function loadAuthContextForUser(
  db: SupabaseClient,
  userId: string,
  email: string
): Promise<AuthContext | null> {
  // Prefer the active-workspace cookie when the caller is a real browser
  // session. The MCP bearer-token path runs under runWithAuthOverride and
  // returns early before ever reaching this function, so there is no cookie
  // to conflict with there.
  let activeId: string | null = null;
  try {
    const jar = await cookies();
    activeId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    // cookies() can throw outside a request scope (e.g. in tests). Fall
    // through to first-membership.
  }

  let member: WorkspaceMember | null = null;

  if (activeId) {
    const { data } = await db
      .from("workspace_members")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", activeId)
      .maybeSingle<WorkspaceMember>();
    member = data ?? null;
  }

  if (!member) {
    const { data } = await db
      .from("workspace_members")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<WorkspaceMember>();
    member = data ?? null;
  }

  if (!member) return null;

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    db
      .from("workspaces")
      .select("*")
      .eq("id", member.workspace_id)
      .single<Workspace>(),
    db.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
  ]);

  if (!workspace) return null;

  return { userId, email, profile, workspace, member };
}

/**
 * Resolves the full auth context: the user, their profile, and their active
 * workspace membership (first workspace they belong to). Returns null when the
 * user is unauthenticated or has no workspace yet. Cached per request.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const override = getAuthOverride();
  if (override) return override.ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return loadAuthContextForUser(supabase, user.id, user.email ?? "");
});

/**
 * Like getAuthContext, but redirects: to /login when unauthenticated, or to
 * /onboarding when the user has no workspace yet. Use in protected pages/actions.
 *
 * When invoked under `runWithAuthOverride` (MCP path), the override is
 * returned directly and no redirect can fire.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const override = getAuthOverride();
  if (override) return override.ctx;

  const userId = await getUserId();
  if (!userId) redirect("/login");

  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  return ctx;
}
