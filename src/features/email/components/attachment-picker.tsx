"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import type { AttachmentWithUrl } from "@/features/attachments/queries";
import type { InvoiceWithUrl } from "@/features/invoices/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";

export interface PickedAttachment {
  id: string;
  type: "file" | "invoice";
  name: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface AttachmentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: AttachmentWithUrl[];
  invoices: InvoiceWithUrl[];
  selected: PickedAttachment[];
  onChange: (selected: PickedAttachment[]) => void;
}

/** Dialog letting the compose form pick existing workspace files/invoices to attach. */
export function AttachmentPicker({
  open,
  onOpenChange,
  files,
  invoices,
  selected,
  onChange,
}: AttachmentPickerProps) {
  const [draft, setDraft] = useState<PickedAttachment[]>(selected);

  function toggle(item: PickedAttachment, checked: boolean) {
    setDraft((prev) =>
      checked
        ? [...prev, item]
        : prev.filter((p) => !(p.id === item.id && p.type === item.type))
    );
  }

  function isChecked(id: string, type: PickedAttachment["type"]) {
    return draft.some((p) => p.id === id && p.type === type);
  }

  function onApply() {
    onChange(draft);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(selected);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach files</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="max-h-80 space-y-1 overflow-y-auto">
            {files.length === 0 ? (
              <EmptyState icon={FileText} title="No files yet" />
            ) : (
              files.map((file) => (
                <label
                  key={file.id}
                  className="hover:bg-accent/40 flex items-center gap-3 rounded-md p-2 text-sm"
                >
                  <Checkbox
                    checked={isChecked(file.id, "file")}
                    onCheckedChange={(checked) =>
                      toggle(
                        { id: file.id, type: "file", name: file.file_name },
                        checked === true
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{file.file_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatSize(file.file_size)}
                  </span>
                </label>
              ))
            )}
          </TabsContent>
          <TabsContent value="invoices" className="max-h-80 space-y-1 overflow-y-auto">
            {invoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" />
            ) : (
              invoices.map((invoice) => (
                <label
                  key={invoice.id}
                  className="hover:bg-accent/40 flex items-center gap-3 rounded-md p-2 text-sm"
                >
                  <Checkbox
                    checked={isChecked(invoice.id, "invoice")}
                    onCheckedChange={(checked) =>
                      toggle(
                        { id: invoice.id, type: "invoice", name: invoice.file_name },
                        checked === true
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {invoice.vendor || invoice.file_name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatSize(invoice.file_size)}
                  </span>
                </label>
              ))
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onApply}>
            Attach{draft.length ? ` (${draft.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
