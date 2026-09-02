"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { encryptSecret } from "@/lib/security/secret-box";
import { emailConnectionSchema } from "@/features/email/schemas";
import { resolveEmailCredentials } from "@/features/email/settings-queries";
import { verifyConnection } from "@/features/email/transport";

export interface ActionResult {
  error?: string;
}

export async function saveEmailConnection(
  values: unknown
): Promise<ActionResult> {
  const parsed = emailConnectionSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const supabase = await createClient();

  // Use the newly entered password if present, otherwise keep the existing one
  // (so the connection can be edited without re-typing the app password).
  let encrypted_password: string | null;
  if (parsed.data.password && parsed.data.password.length) {
    try {
      encrypted_password = encryptSecret(parsed.data.password);
    } catch (e) {
      console.error("Failed to encrypt email password:", e);
      return {
        error:
          "Could not save the mailbox — encryption isn't configured on this server. Ask your administrator to set AI_KEY_ENCRYPTION_SECRET.",
      };
    }
  } else {
    const { data: existing } = await supabase
      .from("workspace_email_settings")
      .select("encrypted_password")
      .eq("workspace_id", ctx.workspace.id)
      .maybeSingle<{ encrypted_password: string | null }>();
    encrypted_password = existing?.encrypted_password ?? null;
    if (!encrypted_password) {
      return { error: "Enter the mailbox password (or app password) to connect." };
    }
  }

  const { error } = await supabase.from("workspace_email_settings").upsert({
    workspace_id: ctx.workspace.id,
    from_name: parsed.data.fromName || null,
    from_email: parsed.data.fromEmail,
    auth_type: "basic",
    smtp_host: parsed.data.smtpHost,
    smtp_port: Number(parsed.data.smtpPort),
    smtp_secure: parsed.data.smtpSecure,
    imap_host: parsed.data.imapHost,
    imap_port: Number(parsed.data.imapPort),
    imap_secure: parsed.data.imapSecure,
    encrypted_password,
    email_preview: parsed.data.fromEmail,
    last_verified_at: null,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/email");
  return {};
}

/** Verifies the saved SMTP + IMAP connection and records last_verified_at. */
export async function testEmailConnection(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const creds = await resolveEmailCredentials(ctx.workspace.id);
  if (!creds) {
    return { error: "Save the mailbox connection first, then test it." };
  }

  const result = await verifyConnection(creds);
  if (!result.ok) {
    return { error: result.error ?? "Could not connect to the mail server." };
  }

  const supabase = await createClient();
  await supabase
    .from("workspace_email_settings")
    .update({ last_verified_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspace.id);

  revalidatePath("/settings");
  return {};
}

export async function clearEmailConnection(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_email_settings")
    .delete()
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/email");
  return {};
}
