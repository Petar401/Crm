"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { INVOICE_BUCKET } from "@/features/invoices/constants";
import {
  invoiceFolderSchema,
  invoiceMetadataSchema,
  invoiceRecordSchema,
} from "@/features/invoices/schemas";

export interface ActionResult {
  error?: string;
}

/** Parses a free-text amount into a non-negative number, or null. */
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normalizes an optional trimmed string down to a value or null. */
function nullifyEmpty(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Records invoice metadata after the file has been uploaded to storage. */
export async function recordInvoice(values: unknown): Promise<ActionResult> {
  const parsed = invoiceRecordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("invoices.upload");

  // The storage path must live under this workspace's prefix.
  if (!parsed.data.storage_path.startsWith(`${ctx.workspace.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    workspace_id: ctx.workspace.id,
    folder_id: parsed.data.folder_id ?? null,
    doc_type: parsed.data.doc_type,
    vendor: nullifyEmpty(parsed.data.vendor),
    amount: parseAmount(parsed.data.amount),
    currency: nullifyEmpty(parsed.data.currency),
    invoice_date: nullifyEmpty(parsed.data.invoice_date),
    file_name: parsed.data.file_name,
    storage_bucket: INVOICE_BUCKET,
    storage_path: parsed.data.storage_path,
    mime_type: parsed.data.mime_type ?? null,
    file_size: parsed.data.file_size ?? null,
    uploaded_by: ctx.userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return {};
}

/** Updates the metadata of an existing invoice (not the underlying file). */
export async function updateInvoice(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = invoiceMetadataSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("invoices.upload");

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      doc_type: parsed.data.doc_type,
      vendor: nullifyEmpty(parsed.data.vendor),
      amount: parseAmount(parsed.data.amount),
      currency: nullifyEmpty(parsed.data.currency),
      invoice_date: nullifyEmpty(parsed.data.invoice_date),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return {};
}

/** Deletes an invoice: removes the storage object, then the row. */
export async function deleteInvoice(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("invoices.delete");

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("storage_path")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ storage_path: string }>();

  if (!invoice) return { error: "Invoice not found." };

  await supabase.storage.from(INVOICE_BUCKET).remove([invoice.storage_path]);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return {};
}

/** Creates an invoice folder. */
export async function createInvoiceFolder(
  values: unknown
): Promise<ActionResult & { id?: string }> {
  const parsed = invoiceFolderSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("invoices.upload");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_folders")
    .insert({
      workspace_id: ctx.workspace.id,
      parent_id: parsed.data.parent_id ?? null,
      name: parsed.data.name,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return { id: data.id };
}

/** Renames an existing invoice folder. */
export async function renameInvoiceFolder(
  id: string,
  name: string
): Promise<ActionResult> {
  const parsed = invoiceFolderSchema.pick({ name: true }).safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("invoices.upload");

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_folders")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return {};
}

/** Deletes an empty invoice folder (no invoices and no subfolders). */
export async function deleteInvoiceFolder(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("invoices.delete");

  const supabase = await createClient();

  const [{ count: invoiceCount }, { count: subfolderCount }] = await Promise.all(
    [
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspace.id)
        .eq("folder_id", id),
      supabase
        .from("invoice_folders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspace.id)
        .eq("parent_id", id),
    ]
  );

  if ((invoiceCount ?? 0) > 0 || (subfolderCount ?? 0) > 0) {
    return { error: "Folder is not empty. Remove its contents first." };
  }

  const { error } = await supabase
    .from("invoice_folders")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/invoices");
  return {};
}

/**
 * Returns a short-lived signed URL for viewing/downloading an invoice file.
 * Requires `invoices.view` and asserts the requested path lives under the
 * current workspace's storage prefix.
 */
export async function getInvoiceSignedUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const ctx = await requireAuthContext();
  await requirePermission("invoices.view");

  if (!storagePath.startsWith(`${ctx.workspace.id}/`)) {
    return { error: "Invalid storage path." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
