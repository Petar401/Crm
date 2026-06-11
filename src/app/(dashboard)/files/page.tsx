import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getFolders,
  getWorkspaceFiles,
  getRecordAttachments,
} from "@/features/attachments/queries";
import { FilesManager } from "@/features/attachments/components/files-manager";
import { FilesGallery } from "@/features/attachments/components/files-gallery";
import { PageHeader } from "@/components/shared/page-header";
import type { Folder } from "@/lib/db/types";

export const dynamic = "force-dynamic";

interface Crumb {
  id: string | null;
  name: string;
}

/** Walks parent links to build the breadcrumb trail for the open folder. */
function buildBreadcrumb(folders: Folder[], folderId: string | null): Crumb[] {
  const trail: Crumb[] = [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cursor = folderId ? byId.get(folderId) : undefined;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    trail.unshift({ id: cursor.id, name: cursor.name });
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  return [{ id: null, name: "Files" }, ...trail];
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("files.view")) redirect("/");

  const folders = await getFolders(ctx.workspace.id);
  const { folder: folderParam } = await searchParams;
  // Only honor a folder id that actually exists in this workspace.
  const currentFolderId =
    folderParam && folders.some((f) => f.id === folderParam)
      ? folderParam
      : null;

  const [files, recordAttachments] = await Promise.all([
    getWorkspaceFiles(ctx.workspace.id, currentFolderId),
    getRecordAttachments(ctx.workspace.id),
  ]);

  const subfolders = folders.filter((f) => f.parent_id === currentFolderId);
  const breadcrumb = buildBreadcrumb(folders, currentFolderId);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Files"
          description="Organize files into folders across your workspace"
        />
        <FilesManager
          workspaceId={ctx.workspace.id}
          currentFolderId={currentFolderId}
          breadcrumb={breadcrumb}
          folders={subfolders}
          files={files}
          canUpload={allowed.has("files.upload")}
          canDelete={allowed.has("files.delete")}
        />
      </div>

      {recordAttachments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium">From records</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Files uploaded directly to companies, contacts, and deals.
          </p>
          <FilesGallery
            attachments={recordAttachments}
            canDelete={allowed.has("files.delete")}
          />
        </div>
      )}
    </div>
  );
}
