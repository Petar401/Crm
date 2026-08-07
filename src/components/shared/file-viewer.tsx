"use client";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ViewableFile {
  url: string;
  fileName: string;
  mimeType: string | null;
}

interface FileViewerProps {
  file: ViewableFile | null;
  onOpenChange: (open: boolean) => void;
}

/** Returns true for files this viewer can render inline (images and PDFs). */
export function isViewable(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

/**
 * A shared, in-app lightbox for previewing images and PDFs without downloading.
 * Reuses the short-lived signed URL already attached to a file. The download
 * option is always available as a fallback.
 */
export function FileViewer({ file, onOpenChange }: FileViewerProps) {
  const isImage = file?.mimeType?.startsWith("image/");
  const isPdf = file?.mimeType === "application/pdf";

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 text-left">
            {file?.fileName}
          </DialogTitle>
        </DialogHeader>

        {file && (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/30 flex items-center justify-center rounded-lg border">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url}
                  alt={file.fileName}
                  className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
                />
              ) : isPdf ? (
                <iframe
                  src={file.url}
                  title={file.fileName}
                  className="h-[75vh] w-full rounded-lg"
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2 p-10 text-sm">
                  <FileText className="size-8" />
                  Preview isn&apos;t available for this file type.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
