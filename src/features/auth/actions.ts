"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/utils/site-url";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
  changePasswordSchema,
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

  // Session active — join the single shared workspace (the first user ever
  // bootstraps it). Everyone shares the same companies, notes, files, etc.
  const { error: rpcError } = await supabase.rpc(
    "join_or_create_shared_workspace",
    {}
  );
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
    parsed.data.email,
    { redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password` }
  );
  if (error) return { error: error.message };

  return { success: true };
}

/**
 * Sets a new password for the currently authenticated user. Used by the
 * reset-password page after the recovery link has established a session via
 * /auth/callback, and works as a general change-password action too.
 */
export async function updatePasswordAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Your reset link has expired. Request a new password reset email and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Changes the password for an already-authenticated user from Settings. Unlike
 * `updatePasswordAction` (recovery flow), this re-verifies the current password
 * first and does not redirect, so the user stays where they are.
 */
export async function changePasswordAction(
  values: unknown
): Promise<ActionResult & { success?: boolean }> {
  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You must be signed in." };

  // Re-authenticate with the current password before allowing a change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return { error: "Your current password is incorrect." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  return { success: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Joins an authenticated user who has no workspace yet into the single shared
 * workspace (onboarding fallback). The provided name is only used to name the
 * workspace when this is the very first user and none exists yet.
 */
export async function createWorkspaceAction(
  workspaceName: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("join_or_create_shared_workspace", {
    workspace_name: workspaceName,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}
