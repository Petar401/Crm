"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import {
  createApiTokenSchema,
  TOKEN_PLAINTEXT_PREFIX,
} from "@/features/api-tokens/schemas";

export interface CreateApiTokenResult {
  error?: string;
  /** Plaintext token — shown to the user exactly once. */
  token?: string;
  id?: string;
}

export interface ActionResult {
  error?: string;
}

export async function createApiToken(
  values: unknown
): Promise<CreateApiTokenResult> {
  const parsed = createApiTokenSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("settings.tokens");

  const secret = randomBytes(32).toString("hex");
  const plaintext = `${TOKEN_PLAINTEXT_PREFIX}${secret}`;
  const token_hash = createHash("sha256").update(plaintext).digest("hex");
  const token_prefix = plaintext.slice(0, 12);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      workspace_member_id: ctx.member.id,
      workspace_id: ctx.workspace.id,
      name: parsed.data.name,
      token_hash,
      token_prefix,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { id: data.id, token: plaintext };
}

export async function revokeApiToken(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("settings.tokens");

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_tokens")
    .delete()
    .eq("id", id)
    .eq("workspace_member_id", ctx.member.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}
