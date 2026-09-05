import { z } from "zod";

const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");

export const windowSchema = z.object({ start: time, end: time });

export const availabilitySchema = z.object({
  mon: z.array(windowSchema),
  tue: z.array(windowSchema),
  wed: z.array(windowSchema),
  thu: z.array(windowSchema),
  fri: z.array(windowSchema),
  sat: z.array(windowSchema),
  sun: z.array(windowSchema),
});

export const linkInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes"),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().or(z.literal("")),
  duration_minutes: z.number().int().min(5).max(480),
  buffer_before_minutes: z.number().int().min(0).max(240),
  buffer_after_minutes: z.number().int().min(0).max(240),
  timezone: z.string().min(1),
  min_notice_minutes: z.number().int().min(0),
  max_days_ahead: z.number().int().min(1).max(365),
  is_active: z.boolean(),
  availability: availabilitySchema,
});

export type LinkInput = z.infer<typeof linkInputSchema>;

export const bookSlotSchema = z.object({
  slug: z.string().min(1),
  start_at: z.string().min(1),
  invitee_name: z.string().trim().min(1, "Enter your name"),
  invitee_email: z.string().trim().email("Enter a valid email"),
  invitee_notes: z.string().trim().optional().or(z.literal("")),
});

export type BookSlotInput = z.infer<typeof bookSlotSchema>;
