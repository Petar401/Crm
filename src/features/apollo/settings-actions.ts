"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { encryptSecret } from "@/lib/security/secret-box";
import { saveApolloApiKeySchema } from "@/features/apollo/settings-schemas";

export interface ActionResult {
  error?: string;
}

export async function saveApolloApiKey(values: unknown): Promise<ActionResult> {
  const parsed = saveApolloApiKeySchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  let encrypted_api_key: string;
  try {
    encrypted_api_key = encryptSecret(parsed.data.apiKey);
  } catch (e) {
    console.error("Failed to encrypt Apollo API key:", e);
    return {
      error:
        "Could not save the API key — encryption isn't configured on this server. Ask your administrator to set AI_KEY_ENCRYPTION_SECRET.",
    };
  }
  const key_preview = parsed.data.apiKey.slice(-4);

  const supabase = await createClient();
  const { error } = await supabase.from("workspace_apollo_settings").upsert({
    workspace_id: ctx.workspace.id,
    encrypted_api_key,
    key_preview,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function clearApolloApiKey(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_apollo_settings")
    .delete()
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}
