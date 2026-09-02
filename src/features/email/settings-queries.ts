import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/secret-box";
import type { WorkspaceEmailSettings } from "@/lib/db/types";
import type { EmailCredentials } from "@/features/email/transport";

/** Masked connection summary for display in Settings — never the password. */
export interface EmailSettingsSummary {
  fromName: string | null;
  fromEmail: string;
  emailPreview: string;
  authType: WorkspaceEmailSettings["auth_type"];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

const SUMMARY_COLUMNS =
  "from_name, from_email, email_preview, auth_type, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, last_verified_at, updated_at";

/** RLS-scoped read for the Settings card. Excludes the encrypted password. */
export async function getWorkspaceEmailSettings(
  workspaceId: string
): Promise<EmailSettingsSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_email_settings")
    .select(SUMMARY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .maybeSingle<
      Pick<
        WorkspaceEmailSettings,
        | "from_name"
        | "from_email"
        | "email_preview"
        | "auth_type"
        | "smtp_host"
        | "smtp_port"
        | "smtp_secure"
        | "imap_host"
        | "imap_port"
        | "imap_secure"
        | "last_verified_at"
        | "updated_at"
      >
    >();
  if (!data) return null;
  return {
    fromName: data.from_name,
    fromEmail: data.from_email,
    emailPreview: data.email_preview,
    authType: data.auth_type,
    smtpHost: data.smtp_host,
    smtpPort: data.smtp_port,
    smtpSecure: data.smtp_secure,
    imapHost: data.imap_host,
    imapPort: data.imap_port,
    imapSecure: data.imap_secure,
    lastVerifiedAt: data.last_verified_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Resolves decrypted mailbox credentials for server-side send/fetch. Uses the
 * service-role client so it also works outside a user session. Returns null if
 * the mailbox isn't configured or the stored password can't be decrypted
 * (e.g. AI_KEY_ENCRYPTION_SECRET missing/rotated) — treated as "not connected".
 */
export async function resolveEmailCredentials(
  workspaceId: string
): Promise<EmailCredentials | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_email_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceEmailSettings>();

  if (
    !data ||
    data.auth_type !== "basic" ||
    !data.encrypted_password ||
    !data.smtp_host ||
    !data.smtp_port ||
    !data.imap_host ||
    !data.imap_port
  ) {
    return null;
  }

  let password: string;
  try {
    password = decryptSecret(data.encrypted_password);
  } catch (e) {
    console.error(
      `Failed to decrypt email password for workspace ${workspaceId}:`,
      e
    );
    return null;
  }

  return {
    fromName: data.from_name,
    fromEmail: data.from_email,
    smtpHost: data.smtp_host,
    smtpPort: data.smtp_port,
    smtpSecure: data.smtp_secure,
    imapHost: data.imap_host,
    imapPort: data.imap_port,
    imapSecure: data.imap_secure,
    password,
  };
}

/** Whether a usable mailbox is connected for this workspace. */
export async function isEmailConfigured(workspaceId: string): Promise<boolean> {
  return !!(await resolveEmailCredentials(workspaceId));
}

/**
 * Whether AI_KEY_ENCRYPTION_SECRET is present and well-formed on this
 * deployment (the shared encryption-at-rest secret, reused for the mailbox
 * password). Same check the AI/Apollo settings use.
 */
export function isEmailEncryptionKeyConfigured(): boolean {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  return !!secret && /^[0-9a-f]{64}$/i.test(secret);
}
