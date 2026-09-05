"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { encryptSecret } from "@/lib/security/secret-box";
import { auditLog } from "@/features/audit/log";
import { saveAiApiKeySchema } from "@/features/ai/settings-schemas";

export interface ActionResult {
  error?: string;
}

export async function saveAiApiKey(values: unknown): Promise<ActionResult> {
  const parsed = saveAiApiKeySchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  let encrypted_api_key: string;
  try {
    encrypted_api_key = encryptSecret(parsed.data.apiKey);
  } catch (e) {
    console.error("Failed to encrypt AI API key:", e);
    return {
      error:
        "Could not save the API key — AI encryption isn't configured on this server. Ask your administrator to set AI_KEY_ENCRYPTION_SECRET.",
    };
  }
  const key_preview = parsed.data.apiKey.slice(-4);

  const supabase = await createClient();
  const { error } = await supabase.from("workspace_ai_settings").upsert({
    workspace_id: ctx.workspace.id,
    provider: parsed.data.provider,
    model: parsed.data.model || null,
    encrypted_api_key,
    key_preview,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "settings.ai_key_saved",
    entityType: "workspace_ai_settings",
    after: { provider: parsed.data.provider, model: parsed.data.model || null },
  });

  revalidatePath("/settings");
  return {};
}

export async function clearAiApiKey(): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_ai_settings")
    .delete()
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  await auditLog({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action: "settings.ai_key_cleared",
    entityType: "workspace_ai_settings",
  });

  revalidatePath("/settings");
  return {};
}
