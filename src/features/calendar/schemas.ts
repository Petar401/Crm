import { z } from "zod";

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional().or(z.literal("")),
    location: z.string().trim().optional().or(z.literal("")),
    start_at: z.string().min(1, "Start time is required"),
    end_at: z.string().min(1, "End time is required"),
    all_day: z.boolean(),
    timezone: z.string().trim().optional().or(z.literal("")),
    deal_id: z.string().uuid().optional().or(z.literal("")),
    company_id: z.string().uuid().optional().or(z.literal("")),
    contact_id: z.string().uuid().optional().or(z.literal("")),
    attendees: z
      .array(
        z.object({
          email: z.string().trim().email(),
          name: z.string().trim().optional().or(z.literal("")),
          contact_id: z.string().uuid().optional().or(z.literal("")),
        })
      )
      .optional(),
  })
  .refine((v) => new Date(v.end_at) > new Date(v.start_at), {
    message: "End must be after start",
    path: ["end_at"],
  });

export type EventInput = z.infer<typeof eventInputSchema>;
