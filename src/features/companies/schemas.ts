import { z } from "zod";

export const companyStatuses = [
  "lead",
  "active",
  "customer",
  "inactive",
] as const;

export const companySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  website: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  address_line_1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  status: z.enum(companyStatuses),
});

export type CompanyInput = z.infer<typeof companySchema>;
