import { z } from "zod";

export const campaignFrequencies = ["manual", "daily", "weekly"] as const;
export const leadStatuses = [
  "pending",
  "approved",
  "rejected",
  "converted",
] as const;

/**
 * Form schema for a lead campaign. Per CLAUDE.md, inputs are kept as strings
 * (and booleans for toggles) and converted in the action — no z.coerce so the
 * zodResolver typing stays intact. `targetCategories` is a comma-separated
 * string in the form and split into an array server-side.
 */
export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  business_description: z
    .string()
    .trim()
    .min(10, "Describe your business so the AI can match leads"),
  target_categories: z
    .string()
    .trim()
    .min(1, "Add at least one category, e.g. dentist, law firm"),
  location: z.string().trim().min(1, "Add a city, region or country"),
  country: z.string().trim().optional(),
  frequency: z.enum(campaignFrequencies),
  auto_create: z.boolean(),
  max_results: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .optional()
    .or(z.literal("")),
  // Hour of day (UTC, 0–23) for daily/weekly runs.
  run_hour: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter an hour 0–23")
    .optional()
    .or(z.literal("")),
  // Minimum score (0–100) a discovered lead must reach to be kept.
  min_score: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a number 0–100")
    .optional()
    .or(z.literal("")),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

/**
 * Form schema for a single lead (manual create / edit). Inputs stay as strings
 * and are converted in the action, per CLAUDE.md.
 */
export const leadSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required"),
  website: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address_line_1: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  industry: z.string().trim().optional().or(z.literal("")),
  contact_name: z.string().trim().optional().or(z.literal("")),
  contact_email: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  contact_phone: z.string().trim().optional().or(z.literal("")),
  job_title: z.string().trim().optional().or(z.literal("")),
  owner_user_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(leadStatuses),
  match_score: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a number 0–100")
    .optional()
    .or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;
