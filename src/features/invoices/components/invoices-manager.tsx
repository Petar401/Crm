"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Trash2,
  FileText,
  Download,
  Eye,
  Folder as FolderIcon,
  FolderPlus,
  ChevronRight,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { InvoiceDocType, InvoiceFolder } from "@/lib/db/types";
import type { InvoiceWithUrl } from "@/features/invoices/queries";
import {
  recordInvoice,
  updateInvoice,
  deleteInvoice,
  createInvoiceFolder,
  renameInvoiceFolder,
  deleteInvoiceFolder,
} from "@/features/invoices/actions";
import { INVOICE_BUCKET } from "@/features/invoices/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FileViewer, isViewable, type ViewableFile } from "@/components/shared/file-viewer";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Crumb {
  id: string | null;
  name: string;
}

interface InvoicesManagerProps {
  workspaceId: string;
  currentFolderId: string | null;
  breadcrumb: Crumb[];
  folders: InvoiceFolder[];
  invoices: InvoiceWithUrl[];
  canUpload: boolean;
  canDelete: boolean;
}

interface MetaState {
  doc_type: InvoiceDocType;
  vendor: string;
  amount: string;
  currency: string;
  invoice_date: string;
}

const emptyMeta: MetaState = {
  doc_type: "invoice",
  vendor: "",
  amount: "",
  currency: "",
  invoice_date: "",
};

const DOC_TYPE_LABELS: Record<InvoiceDocType, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  other: "Other",
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function folderHref(id: string | null): string {
  return id ? `/invoices?folder=${id}` : "/invoices";
}

/** Shared metadata inputs used by both the upload and edit dialogs. */
function MetadataFields({
  value,
  onChange,
  disabled,
}: {
  value: MetaState;
  onChange: (next: MetaState) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select
          value={value.doc_type}
          onValueChange={(v) => onChange({ ...value, doc_type: v as InvoiceDocType })}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="receipt">Receipt</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input
          type="date"
          value={value.invoice_date}
          onChange={(e) => onChange({ ...value, invoice_date: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Vendor</Label>
        <Input
          placeholder="e.g. Acme Ltd"
          value={value.vendor}
          onChange={(e) => onChange({ ...value, vendor: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Input
            placeholder="GBP"
            value={value.currency}
            onChange={(e) => onChange({ ...value, currency: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function InvoicesManager({
  workspaceId,
  currentFolderId,
  breadcrumb,
  folders,
  invoices,
  canUpload,
  canDelete,
}: InvoicesManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<InvoiceFolder | null>(null);
  const [renameName, setRenameName] = useState("");

  // Upload dialog state (file + metadata captured before recording).
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState<MetaState>(emptyMeta);

  // Edit dialog state (metadata only).
  const [editing, setEditing] = useState<InvoiceWithUrl | null>(null);
  const [editMeta, setEditMeta] = useState<MetaState>(emptyMeta);

  // In-app viewer.
  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);

  function openViewer(invoice: InvoiceWithUrl) {
    if (!invoice.signed_url) return;
    setViewerFile({
      url: invoice.signed_url,
      fileName: invoice.file_name,
      mimeType: invoice.mime_type,
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadMeta(emptyMeta);
    if (file) setUploadOpen(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = uploadFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${workspaceId}/invoices/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(INVOICE_BUCKET)
        .upload(path, uploadFile, { upsert: false });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const result = await recordInvoice({
        ...uploadMeta,
        folder_id: currentFolderId,
        file_name: uploadFile.name,
        storage_path: path,
        mime_type: uploadFile.type || undefined,
        file_size: uploadFile.size,
      });

      if (result.error) {
        toast.error(result.error);
        await supabase.storage.from(INVOICE_BUCKET).remove([path]);
        return;
      }

      toast.success("Invoice uploaded");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadMeta(emptyMeta);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function onSaveEdit() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateInvoice(editing.id, editMeta);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invoice updated");
      setEditing(null);
      router.refresh();
    });
  }

  function onCreateFolder() {
    startTransition(async () => {
      const result = await createInvoiceFolder({
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
      const result = await renameInvoiceFolder(renaming.id, renameName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder renamed");
      setRenaming(null);
      router.refresh();
    });
  }

  function onDeleteFolder(folder: InvoiceFolder) {
    startTransition(async () => {
      const result = await deleteInvoiceFolder(folder.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder deleted");
      router.refresh();
    });
  }

  async function removeInvoice(id: string) {
    const result = await deleteInvoice(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Invoice deleted");
      router.refresh();
    }
  }

  const isEmpty = folders.length === 0 && invoices.length === 0;

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
              onChange={onPickFile}
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
              ? "Create a folder (e.g. a tax year) or upload an invoice to get started."
              : "No invoices or folders here yet."
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

          {invoices.map((invoice) => {
            const isImage = invoice.mime_type?.startsWith("image/");
            const viewable = isViewable(invoice.mime_type) && !!invoice.signed_url;
            return (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-lg border p-3"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => viewable && openViewer(invoice)}
                    className={`shrink-0 ${viewable ? "cursor-pointer" : "cursor-default"}`}
                    aria-label={viewable ? `Preview ${invoice.file_name}` : undefined}
                  >
                    {isImage && invoice.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={invoice.signed_url}
                        alt={invoice.file_name}
                        className="size-12 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex size-12 items-center justify-center rounded">
                        <FileText className="text-muted-foreground size-5" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {invoice.vendor || invoice.file_name}
                      </p>
                      <Badge variant="secondary" className="shrink-0">
                        {DOC_TYPE_LABELS[invoice.doc_type]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {invoice.file_name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {invoice.amount != null
                        ? `${formatCurrency(invoice.amount, invoice.currency || undefined)} · `
                        : ""}
                      {formatDate(invoice.invoice_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {formatSize(invoice.file_size)}
                    {invoice.file_size ? " · " : ""}
                    {formatDateTime(invoice.created_at)}
                  </p>
                  <div className="flex items-center gap-1">
                    {viewable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openViewer(invoice)}
                        aria-label="Preview"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    )}
                    {invoice.signed_url && (
                      <Button size="icon" variant="ghost" className="size-7" asChild>
                        <a
                          href={invoice.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Download"
                        >
                          <Download className="size-3.5" />
                        </a>
                      </Button>
                    )}
                    {canUpload && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => {
                          setEditing(invoice);
                          setEditMeta({
                            doc_type: invoice.doc_type,
                            vendor: invoice.vendor ?? "",
                            amount: invoice.amount != null ? String(invoice.amount) : "",
                            currency: invoice.currency ?? "",
                            invoice_date: invoice.invoice_date ?? "",
                          });
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => removeInvoice(invoice.id)}
                        aria-label="Delete"
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
      )}

      {/* Upload dialog: file already chosen, capture metadata */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open && !uploading) {
            setUploadOpen(false);
            setUploadFile(null);
            setUploadMeta(emptyMeta);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload invoice</DialogTitle>
          </DialogHeader>
          {uploadFile && (
            <p className="text-muted-foreground truncate text-sm">
              {uploadFile.name}
            </p>
          )}
          <MetadataFields
            value={uploadMeta}
            onChange={setUploadMeta}
            disabled={uploading}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setUploadFile(null);
                setUploadMeta(emptyMeta);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={onUpload} disabled={uploading || !uploadFile}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit metadata dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
          </DialogHeader>
          {editing && (
            <p className="text-muted-foreground truncate text-sm">
              {editing.file_name}
            </p>
          )}
          <MetadataFields
            value={editMeta}
            onChange={setEditMeta}
            disabled={pending}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={onSaveEdit} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Folder name (e.g. Tax year 2025)"
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

      <FileViewer file={viewerFile} onOpenChange={(open) => !open && setViewerFile(null)} />
    </div>
  );
}
