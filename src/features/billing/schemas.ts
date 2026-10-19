import { z } from "zod";

// eslint-disable-next-line security/detect-unsafe-regex -- anchored decimal, bounded groups
const decimal2 = /^\d+(\.\d{1,2})?$/;

export const invoiceHeaderSchema = z.object({
  deal_id: z.string().uuid().optional().or(z.literal("")),
  quote_id: z.string().uuid().optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  due_date: z.string().trim().optional().or(z.literal("")),
  memo: z.string().trim().optional().or(z.literal("")),
});

export type InvoiceHeaderInput = z.infer<typeof invoiceHeaderSchema>;

export const recordPaymentSchema = z.object({
  amount: z.string().trim().regex(decimal2, "Enter an amount like 199.99"),
  method: z.string().trim().optional().or(z.literal("")),
  external_ref: z.string().trim().optional().or(z.literal("")),
  paid_at: z.string().trim().optional().or(z.literal("")),
  note: z.string().trim().optional().or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
