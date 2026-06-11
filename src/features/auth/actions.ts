"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
} from "@/features/auth/schemas";

export interface ActionResult {
  error?: string;
}

export async function loginAction(values: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signupAction(values: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) return { error: error.message };

  // Users are auto-confirmed at the DB level (see migration 0007), but Supabase
  // may still withhold a session at signup when email confirmation is enabled.
  // Sign in immediately to obtain a session before bootstrapping the workspace.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) {
      return {
        error:
          "Account created. Please sign in to finish setting up your workspace.",
      };
    }
  }

  // Session active — create the workspace and owner membership.
  const { error: rpcError } = await supabase.rpc("create_workspace_for_user", {
    workspace_name: parsed.data.workspaceName,
  });
  if (rpcError) return { error: rpcError.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(
  values: unknown
): Promise<ActionResult & { success?: boolean }> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email
  );
  if (error) return { error: error.message };

  return { success: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Creates a workspace for an authenticated user who has none yet (onboarding). */
export async function createWorkspaceAction(
  workspaceName: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_workspace_for_user", {
    workspace_name: workspaceName,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}
