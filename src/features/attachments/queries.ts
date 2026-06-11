import { createClient } from "@/lib/supabase/server";
import type { Attachment, EntityType, Folder } from "@/lib/db/types";
import { ATTACHMENT_BUCKET } from "@/features/attachments/constants";

export interface AttachmentWithUrl extends Attachment {
  signed_url: string | null;
}

async function withSignedUrls(
  attachments: Attachment[]
): Promise<AttachmentWithUrl[]> {
  if (attachments.length === 0) return [];
  const supabase = await createClient();
  const paths = attachments.map((a) => a.storage_path);
  const { data: signed } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, 60 * 10);

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
  );

  return attachments.map((a) => ({
    ...a,
    signed_url: urlByPath.get(a.storage_path) ?? null,
  }));
}

export async function getEntityAttachments(
  workspaceId: string,
  entityType: EntityType,
  entityId: string
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  return withSignedUrls((data ?? []) as Attachment[]);
}

export async function getAllAttachments(
  workspaceId: string
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return withSignedUrls((data ?? []) as Attachment[]);
}

/** All folders in a workspace (used to build the tree and breadcrumbs). */
export async function getFolders(workspaceId: string): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  return (data ?? []) as Folder[];
}

/** Standalone workspace files within a given folder (null = root). */
export async function getWorkspaceFiles(
  workspaceId: string,
  folderId: string | null
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient();
  let query = supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "workspace");

  query = folderId
    ? query.eq("folder_id", folderId)
    : query.is("folder_id", null);

  const { data } = await query.order("created_at", { ascending: false });
  return withSignedUrls((data ?? []) as Attachment[]);
}

/** Files attached to CRM records (everything except the file manager). */
export async function getRecordAttachments(
  workspaceId: string
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("entity_type", "workspace")
    .order("created_at", { ascending: false });

  return withSignedUrls((data ?? []) as Attachment[]);
}
