"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Trash2,
  FileText,
  Download,
  Folder as FolderIcon,
  FolderPlus,
  ChevronRight,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { Folder } from "@/lib/db/types";
import type { AttachmentWithUrl } from "@/features/attachments/queries";
import {
  recordAttachment,
  deleteAttachment,
  createFolder,
  renameFolder,
  deleteFolder,
} from "@/features/attachments/actions";
import { ATTACHMENT_BUCKET } from "@/features/attachments/constants";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Crumb {
  id: string | null;
  name: string;
}

interface FilesManagerProps {
  workspaceId: string;
  currentFolderId: string | null;
  breadcrumb: Crumb[];
  folders: Folder[];
  files: AttachmentWithUrl[];
  canUpload: boolean;
  canDelete: boolean;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function folderHref(id: string | null): string {
  return id ? `/files?folder=${id}` : "/files";
}

export function FilesManager({
  workspaceId,
  currentFolderId,
  breadcrumb,
  folders,
  files,
  canUpload,
  canDelete,
}: FilesManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [renameName, setRenameName] = useState("");

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${workspaceId}/workspace/${workspaceId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const result = await recordAttachment({
        entity_type: "workspace",
        entity_id: workspaceId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || undefined,
        file_size: file.size,
        folder_id: currentFolderId,
      });

      if (result.error) {
        toast.error(result.error);
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
        return;
      }

      toast.success("File uploaded");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onCreateFolder() {
    startTransition(async () => {
      const result = await createFolder({
        name: newName,
        parent_id: currentFolderId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder created");
      setNewOpen(false);
      setNewName("");
      router.refresh();
    });
  }

  function onRenameFolder() {
    if (!renaming) return;
    startTransition(async () => {
      const result = await renameFolder(renaming.id, renameName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder renamed");
      setRenaming(null);
      router.refresh();
    });
  }

  function onDeleteFolder(folder: Folder) {
    startTransition(async () => {
      const result = await deleteFolder(folder.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder deleted");
      router.refresh();
    });
  }

  async function removeFile(id: string) {
    const result = await deleteAttachment(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("File deleted");
      router.refresh();
    }
  }

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {breadcrumb.map((crumb, i) => {
            const last = i === breadcrumb.length - 1;
            return (
              <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="text-muted-foreground size-3.5" />
                )}
                {last ? (
                  <span className="font-medium">{crumb.name}</span>
                ) : (
                  <Link
                    href={folderHref(crumb.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {crumb.name}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>

        {canUpload && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewName("");
                setNewOpen(true);
              }}
            >
              <FolderPlus className="size-4" />
              New folder
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={onFileSelected}
            />
            <Button
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={FolderIcon}
          title="This folder is empty"
          description={
            canUpload
              ? "Create a folder or upload a file to get started."
              : "No files or folders here yet."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <Link
                href={folderHref(folder.id)}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded">
                  <FolderIcon className="size-5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-muted-foreground text-xs">Folder</p>
                </div>
              </Link>
              {(canUpload || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpload && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenaming(folder);
                          setRenameName(folder.name);
                        }}
                      >
                        <Pencil className="size-4" />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDeleteFolder(folder)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}

          {files.map((file) => {
            const isImage = file.mime_type?.startsWith("image/");
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                {isImage && file.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.signed_url}
                    alt={file.file_name}
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded">
                    <FileText className="text-muted-foreground size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {file.file_name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatSize(file.file_size)} ·{" "}
                    {formatDateTime(file.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {file.signed_url && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      asChild
                    >
                      <a
                        href={file.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New folder dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Folder name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) onCreateFolder();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={onCreateFolder} disabled={pending || !newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Folder name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameName.trim()) onRenameFolder();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenaming(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={onRenameFolder}
              disabled={pending || !renameName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
