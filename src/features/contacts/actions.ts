"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { contactSchema } from "@/features/contacts/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function createContact(values: unknown): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("contacts.create");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
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
    title: `Contact created: ${parsed.data.first_name} ${parsed.data.last_name}`,
    companyId: parsed.data.company_id,
    contactId: data.id,
  });

  revalidatePath("/contacts");
  return { id: data.id };
}

export async function updateContact(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("contacts.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update(parsed.data)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { id };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("contacts.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return {};
}
