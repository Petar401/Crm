import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/security/secret-box";
import { randomBytes } from "node:crypto";
import type { WorkspaceBillingSettings } from "@/lib/db/types";

export async function getBillingSettings(
  workspaceId: string
): Promise<WorkspaceBillingSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_billing_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<WorkspaceBillingSettings>();
  return data;
}

export async function getBillingSettingsByWebhookSlug(
  slug: string
): Promise<WorkspaceBillingSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_billing_settings")
    .select("*")
    .eq("webhook_endpoint_slug", slug)
    .maybeSingle<WorkspaceBillingSettings>();
  return data;
}

/**
 * Loads the workspace's Stripe secret key. Server-only — the plaintext key
 * never leaves the module. Returns null when Stripe isn't configured for
 * the workspace.
 */
export async function loadStripeSecret(workspaceId: string): Promise<string | null> {
  const settings = await getBillingSettings(workspaceId);
  if (!settings?.stripe_enabled || !settings.encrypted_stripe_secret_key) {
    return null;
  }
  try {
    return decryptSecret(settings.encrypted_stripe_secret_key);
  } catch {
    return null;
  }
}

export interface UpsertSettingsInput {
  stripe_enabled: boolean;
  stripe_publishable_key: string;
  stripe_secret_key?: string; // plaintext; only re-encrypted when non-empty
  webhook_secret?: string;
  auto_invoice_on_won: boolean;
  send_dunning: boolean;
  dunning_schedule_days: number[];
  tax_inclusive: boolean;
  currency: string;
}

export async function upsertBillingSettings(
  workspaceId: string,
  input: UpsertSettingsInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const existing = await getBillingSettings(workspaceId);
  const patch: Partial<WorkspaceBillingSettings> = {
    stripe_enabled: input.stripe_enabled,
    stripe_publishable_key: input.stripe_publishable_key || null,
    auto_invoice_on_won: input.auto_invoice_on_won,
    send_dunning: input.send_dunning,
    dunning_schedule_days: input.dunning_schedule_days,
    tax_inclusive: input.tax_inclusive,
    currency: input.currency.toUpperCase(),
  };
  if (input.stripe_secret_key && input.stripe_secret_key.trim()) {
    patch.encrypted_stripe_secret_key = encryptSecret(input.stripe_secret_key.trim());
  }
  if (input.webhook_secret !== undefined) {
    patch.webhook_secret = input.webhook_secret.trim() || null;
  }
  if (!existing?.webhook_endpoint_slug) {
    patch.webhook_endpoint_slug = randomBytes(16).toString("hex");
  }

  if (existing) {
    const { error } = await supabase
      .from("workspace_billing_settings")
      .update(patch)
      .eq("workspace_id", workspaceId);
    return error ? { error: error.message } : {};
  }
  const { error } = await supabase
    .from("workspace_billing_settings")
    .insert({ workspace_id: workspaceId, ...patch });
  return error ? { error: error.message } : {};
}
