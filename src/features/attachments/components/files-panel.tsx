"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, FileText, Download } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { EntityType } from "@/lib/db/types";
import type { AttachmentWithUrl } from "@/features/attachments/queries";
import {
  recordAttachment,
  deleteAttachment,
} from "@/features/attachments/actions";
import { ATTACHMENT_BUCKET } from "@/features/attachments/constants";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

interface FilesPanelProps {
  attachments: AttachmentWithUrl[];
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  canUpload: boolean;
  canDelete: boolean;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesPanel({
  attachments,
  workspaceId,
  entityType,
  entityId,
  canUpload,
  canDelete,
}: FilesPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${workspaceId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const result = await recordAttachment({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || undefined,
        file_size: file.size,
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

  async function remove(id: string) {
    const result = await deleteAttachment(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("File deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </div>
      )}

      {attachments.length === 0 ? (
        <EmptyState icon={FileText} title="No files yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {attachments.map((file) => {
            const isImage = file.mime_type?.startsWith("image/");
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                {isImage && file.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.signed_url}
                    alt={file.file_name}
                    className="size-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded">
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
                    <Button size="icon" variant="ghost" className="size-7" asChild>
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
                      onClick={() => remove(file.id)}
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
    </div>
  );
}
