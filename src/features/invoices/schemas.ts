import { z } from "zod";

/** Document types an uploaded invoice file can represent. */
export const invoiceDocTypes = ["invoice", "receipt", "other"] as const;

/**
 * Metadata carried by an invoice record. Kept as plain strings (no
 * `z.coerce`/`z.transform`) so `zodResolver` typing stays intact — `amount`
 * and `invoice_date` are converted to their DB types in the server action.
 */
export const invoiceMetadataSchema = z.object({
  doc_type: z.enum(invoiceDocTypes),
  vendor: z.string().trim().max(200).optional(),
  amount: z.string().trim().max(30).optional(),
  currency: z.string().trim().max(10).optional(),
  invoice_date: z.string().trim().max(20).optional(),
  folder_id: z.string().uuid().nullable().optional(),
});

export type InvoiceMetadataInput = z.infer<typeof invoiceMetadataSchema>;

/** Full payload recorded after a file has been uploaded to storage. */
export const invoiceRecordSchema = invoiceMetadataSchema.extend({
  file_name: z.string().min(1),
  storage_path: z.string().min(1),
  mime_type: z.string().optional(),
  file_size: z.number().int().nonnegative().optional(),
});

export type InvoiceRecordInput = z.infer<typeof invoiceRecordSchema>;

/** Folder create/rename payload. */
export const invoiceFolderSchema = z.object({
  name: z.string().trim().min(1, "Enter a folder name").max(120),
  parent_id: z.string().uuid().nullable().optional(),
});

export type InvoiceFolderInput = z.infer<typeof invoiceFolderSchema>;
