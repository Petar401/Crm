import { z } from "zod";

export const productKinds = ["one_time", "recurring"] as const;
export const recurringIntervals = ["day", "week", "month", "year"] as const;

const priceString = z
  .string()
  .trim()
  // eslint-disable-next-line security/detect-unsafe-regex -- simple anchored decimal, bounded groups
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a price like 199.99");

const bpsString = z
  .string()
  .trim()
  .regex(/^\d{1,5}$/, "Enter a whole number in basis points");

export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    sku: z.string().trim().optional().or(z.literal("")),
    description: z.string().trim().optional().or(z.literal("")),
    kind: z.enum(productKinds),
    recurring_interval: z.enum(recurringIntervals).optional().or(z.literal("")),
    unit: z.string().trim().min(1, "Unit is required"),
    default_currency: z
      .string()
      .trim()
      .length(3, "Use a 3-letter currency code"),
    default_price: priceString,
    default_tax_rate_id: z.string().trim().uuid().optional().or(z.literal("")),
    is_archived: z.boolean(),
  })
  .refine(
    (v) => v.kind !== "recurring" || !!v.recurring_interval,
    {
      message: "Pick a billing interval for recurring products",
      path: ["recurring_interval"],
    }
  );

export type ProductInput = z.infer<typeof productSchema>;

export const priceBookSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code"),
  is_default: z.boolean(),
});

export type PriceBookInput = z.infer<typeof priceBookSchema>;

export const priceBookEntrySchema = z.object({
  product_id: z.string().uuid(),
  unit_price: priceString,
});

export type PriceBookEntryInput = z.infer<typeof priceBookEntrySchema>;

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  rate_bps: bpsString,
  region: z.string().trim().optional().or(z.literal("")),
  is_default: z.boolean(),
});

export type TaxRateInput = z.infer<typeof taxRateSchema>;
