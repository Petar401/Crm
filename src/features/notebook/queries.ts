import { createClient } from "@/lib/supabase/server";
import type { NoteFolder, NotebookNote } from "@/lib/db/types";

export async function getNoteFolders(
  workspaceId: string
): Promise<NoteFolder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("note_folders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []) as NoteFolder[];
}

export async function getNotebookNotes(
  workspaceId: string
): Promise<NotebookNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notebook_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as NotebookNote[];
}
