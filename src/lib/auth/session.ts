import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Workspace, WorkspaceMember } from "@/lib/db/types";

export interface AuthContext {
  userId: string;
  email: string;
  profile: Profile | null;
  workspace: Workspace;
  member: WorkspaceMember;
}

/** The authenticated auth.users id, or null. Cached per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

/**
 * Resolves the full auth context: the user, their profile, and their active
 * workspace membership (first workspace they belong to). Returns null when the
 * user is unauthenticated or has no workspace yet. Cached per request.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WorkspaceMember>();

  if (!member) {
    return null;
  }

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("*")
      .eq("id", member.workspace_id)
      .single<Workspace>(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
  ]);

  if (!workspace) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    workspace,
    member,
  };
});

/**
 * Like getAuthContext, but redirects: to /login when unauthenticated, or to
 * /onboarding when the user has no workspace yet. Use in protected pages/actions.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const ctx = await getAuthContext();
  if (!ctx) redirect("/onboarding");

  return ctx;
}
