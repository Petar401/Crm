import { z } from "zod";

/** A shared note. `folder_id` is optional — empty string means "no folder". */
export const noteSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.string().optional(),
  folder_id: z.string().optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;

/** A folder used to group shared notes. */
export const folderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required"),
});

export type FolderInput = z.infer<typeof folderSchema>;
