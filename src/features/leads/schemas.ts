import { z } from "zod";

export const campaignFrequencies = ["manual", "daily", "weekly"] as const;

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
});

export type CampaignInput = z.infer<typeof campaignSchema>;
