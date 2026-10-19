"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { upsertBillingSettings, type UpsertSettingsInput } from "@/features/stripe/settings";

export interface ActionResult {
  error?: string;
}

export async function saveBillingSettings(
  input: UpsertSettingsInput
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.update");
  const r = await upsertBillingSettings(ctx.workspace.id, input);
  if (r.error) return r;
  revalidatePath("/settings/billing");
  return {};
}
