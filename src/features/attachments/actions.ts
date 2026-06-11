"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { ATTACHMENT_BUCKET } from "@/features/attachments/constants";

export interface ActionResult {
  error?: string;
}

const metadataSchema = z.object({
  entity_type: z.enum(["company", "contact", "deal", "note"]),
  entity_id: z.string().uuid(),
  file_name: z.string().min(1),
  storage_path: z.string().min(1),
  mime_type: z.string().optional(),
  file_size: z.number().int().nonnegative().optional(),
});

/** Records attachment metadata after the file has been uploaded to storage. */
export async function recordAttachment(values: unknown): Promise<ActionResult> {
  const parsed = metadataSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("files.upload");

  // The storage path must live under this workspace's prefix.
  if (!parsed.data.storage_path.startsWith(`${ctx.workspace.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    workspace_id: ctx.workspace.id,
    entity_type: parsed.data.entity_type,
    entity_id: parsed.data.entity_id,
    file_name: parsed.data.file_name,
    storage_bucket: ATTACHMENT_BUCKET,
    storage_path: parsed.data.storage_path,
    mime_type: parsed.data.mime_type ?? null,
    file_size: parsed.data.file_size ?? null,
    uploaded_by: ctx.userId,
  });

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "file_uploaded",
    title: `File uploaded: ${parsed.data.file_name}`,
    companyId: parsed.data.entity_type === "company" ? parsed.data.entity_id : undefined,
    contactId: parsed.data.entity_type === "contact" ? parsed.data.entity_id : undefined,
    dealId: parsed.data.entity_type === "deal" ? parsed.data.entity_id : undefined,
  });

  revalidatePath("/", "layout");
  return {};
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("files.delete");

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ storage_path: string }>();

  if (!attachment) return { error: "File not found." };

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path]);

  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

/** Returns a short-lived signed URL for viewing/downloading a stored file. */
export async function getSignedUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  await requireAuthContext();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
