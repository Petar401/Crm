import { z } from "zod";

export const quoteStatuses = [
  "draft",
  "sent",
  "signed",
  "expired",
  "void",
] as const;

// eslint-disable-next-line security/detect-unsafe-regex -- anchored decimal, bounded groups
const decimal2 = /^\d+(\.\d{1,2})?$/;
// eslint-disable-next-line security/detect-unsafe-regex -- anchored decimal, bounded groups
const decimal3 = /^\d+(\.\d{1,3})?$/;

export const quoteHeaderSchema = z.object({
  deal_id: z.string().uuid().optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  valid_until: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type QuoteHeaderInput = z.infer<typeof quoteHeaderSchema>;

export const quoteLineInputSchema = z.object({
  product_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Description is required"),
  quantity: z
    .string()
    .trim()
    .regex(decimal3, "Enter a quantity like 1 or 2.5"),
  unit_price: z
    .string()
    .trim()
    .regex(decimal2, "Enter a price like 199.99"),
  discount_bps: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "Discount in basis points (0–10000)"),
  tax_rate_id: z.string().uuid().optional().or(z.literal("")),
});

export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

export const signQuoteSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  signature_svg: z.string().min(1, "Sign your name to accept"),
});

export type SignQuoteInput = z.infer<typeof signQuoteSchema>;
