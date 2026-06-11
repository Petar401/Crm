"use client";

import { useRouter } from "next/navigation";
import { FileText, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { AttachmentWithUrl } from "@/features/attachments/queries";
import { deleteAttachment } from "@/features/attachments/actions";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ENTITY_HREF: Record<string, (id: string) => string | null> = {
  company: (id) => `/companies/${id}`,
  contact: (id) => `/contacts/${id}`,
  deal: (id) => `/deals/${id}`,
  note: () => null,
};

export function FilesGallery({
  attachments,
  canDelete,
}: {
  attachments: AttachmentWithUrl[];
  canDelete: boolean;
}) {
  const router = useRouter();

  async function remove(id: string) {
    const result = await deleteAttachment(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("File deleted");
      router.refresh();
    }
  }

  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No files yet"
        description="Files uploaded to records across your workspace will appear here."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {attachments.map((file) => {
        const isImage = file.mime_type?.startsWith("image/");
        const href = ENTITY_HREF[file.entity_type]?.(file.entity_id) ?? null;
        return (
          <div key={file.id} className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
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
                <p className="truncate text-sm font-medium">{file.file_name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatSize(file.file_size)} · {formatDateTime(file.created_at)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Badge variant="secondary" className="capitalize">
                {href ? (
                  <a href={href}>{file.entity_type}</a>
                ) : (
                  file.entity_type
                )}
              </Badge>
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
          </div>
        );
      })}
    </div>
  );
}
