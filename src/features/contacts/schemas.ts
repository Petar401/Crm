import { z } from "zod";

export const contactRoles = [
  "decision_maker",
  "influencer",
  "admin",
  "other",
] as const;

export const contactSchema = z.object({
  company_id: z.string().uuid("Select a company"),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional(),
  job_title: z.string().trim().optional(),
  linkedin_url: z.string().trim().optional(),
  contact_role: z.enum(contactRoles),
  is_primary: z.boolean(),
});

export type ContactInput = z.infer<typeof contactSchema>;
