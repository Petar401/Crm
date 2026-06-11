import { z } from "zod";

export const dealStatuses = ["open", "won", "lost"] as const;

export const dealSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company_id: z.string().uuid("Select a company"),
  primary_contact_id: z.string().uuid().optional().or(z.literal("")),
  pipeline_id: z.string().uuid().optional().or(z.literal("")),
  stage_id: z.string().uuid().optional().or(z.literal("")),
  value: z.string().trim().optional(),
  currency: z.string().trim().min(1),
  probability: z.string().trim().optional(),
  expected_close_date: z.string().optional().or(z.literal("")),
  status: z.enum(dealStatuses),
  source: z.string().trim().optional(),
  next_step: z.string().trim().optional(),
});

export type DealInput = z.infer<typeof dealSchema>;
