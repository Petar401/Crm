import { z } from "zod";

/**
 * Connection presets shown in the Settings form. Selecting one prefills the
 * SMTP/IMAP host/port fields; the user can still override them (e.g. a custom
 * business-domain mail server). "generic" leaves the fields blank.
 */
export const PROVIDER_PRESETS = {
  gmail: {
    label: "Gmail / Google Workspace",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    hint: "Requires a Google App Password (2-Step Verification must be on). Your normal password will not work.",
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    hint: "Some Microsoft 365 tenants disable basic auth — if login fails, ask your admin to enable IMAP/SMTP or wait for the OAuth sign-in option.",
  },
  generic: {
    label: "Other (custom mail server)",
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    hint: "Enter the SMTP and IMAP details from your email provider.",
  },
} as const;

export type ProviderPresetKey = keyof typeof PROVIDER_PRESETS;

const portString = z
  .string()
  .trim()
  .regex(/^\d{1,5}$/, "Enter a valid port number");

// Inputs stay as strings (CLAUDE.md: no z.coerce on form schemas); the action
// converts port strings to numbers. `password` is optional so an existing
// connection can be edited without re-typing it.
export const emailConnectionSchema = z.object({
  fromName: z.string().trim().max(120).optional().or(z.literal("")),
  fromEmail: z.string().trim().email("Enter a valid email address"),
  smtpHost: z.string().trim().min(1, "SMTP host is required"),
  smtpPort: portString,
  smtpSecure: z.boolean(),
  imapHost: z.string().trim().min(1, "IMAP host is required"),
  imapPort: portString,
  imapSecure: z.boolean(),
  password: z.string().min(1).optional().or(z.literal("")),
});

export type EmailConnectionInput = z.infer<typeof emailConnectionSchema>;

/** Splits a comma/semicolon-separated recipient string into trimmed addresses. */
export function parseRecipients(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const emailListString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine(
    (v) =>
      parseRecipients(v).every((addr) => z.string().email().safeParse(addr).success),
    { message: "One or more addresses are invalid" }
  );

const optionalId = z.string().uuid().optional().or(z.literal(""));

export const composeEmailSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, "Add at least one recipient")
    .refine(
      (v) =>
        parseRecipients(v).length > 0 &&
        parseRecipients(v).every(
          (addr) => z.string().email().safeParse(addr).success
        ),
      { message: "Enter one or more valid email addresses" }
    ),
  cc: emailListString,
  bcc: emailListString,
  subject: z.string().trim().min(1, "Subject is required").max(255),
  body: z.string().min(1, "Write a message"),
  contactId: optionalId,
  companyId: optionalId,
  dealId: optionalId,
});

export type ComposeEmailInput = z.infer<typeof composeEmailSchema>;
