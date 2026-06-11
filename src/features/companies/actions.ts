"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { companySchema } from "@/features/companies/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function createCompany(values: unknown): Promise<ActionResult> {
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("companies.create");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...parsed.data,
      workspace_id: ctx.workspace.id,
      owner_user_id: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Company created: ${parsed.data.name}`,
    companyId: data.id,
  });

  revalidatePath("/companies");
  return { id: data.id };
}

export async function updateCompany(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("companies.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update(parsed.data)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return { id };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("companies.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/companies");
  return {};
}
