"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { noteSchema, folderSchema } from "@/features/notebook/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export async function createNotebookNote(
  values: unknown
): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("notebook.create");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notebook_notes")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body ?? "",
      folder_id: parsed.data.folder_id || null,
      workspace_id: ctx.workspace.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { id: data.id };
}

export async function updateNotebookNote(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("notebook.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notebook_notes")
    .update({
      title: parsed.data.title,
      body: parsed.data.body ?? "",
      folder_id: parsed.data.folder_id || null,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { id };
}

export async function deleteNotebookNote(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("notebook.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notebook_notes")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return {};
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------
export async function createNoteFolder(
  values: unknown
): Promise<ActionResult> {
  const parsed = folderSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("notebook.create");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("note_folders")
    .insert({
      name: parsed.data.name,
      workspace_id: ctx.workspace.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { id: data.id };
}

export async function renameNoteFolder(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = folderSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("notebook.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("note_folders")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { id };
}

/**
 * Deletes a folder. Its notes are preserved — `folder_id` is set null by the
 * database (on delete set null), so they move back to "Unfiled".
 */
export async function deleteNoteFolder(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("notebook.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("note_folders")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return {};
}
