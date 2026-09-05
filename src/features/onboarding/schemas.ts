import { z } from "zod";

export const profileStepSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  industry: z.string().max(60).optional(),
  timezone: z.string().min(1).default("UTC"),
  currency: z.string().length(3).default("USD"),
  locale: z.string().min(2).max(10).default("en-US"),
});
export type ProfileStepValues = z.infer<typeof profileStepSchema>;

export const inviteRowSchema = z.object({
  email: z.string().email(),
  roleName: z.string().default("Sales Rep"),
});
export const invitesStepSchema = z.object({
  invites: z.array(inviteRowSchema).max(20),
});
export type InvitesStepValues = z.infer<typeof invitesStepSchema>;

export const templateStepSchema = z.object({
  templateKey: z.enum(["empty", "agency", "consultancy", "trades", "ecommerce", "saas"]),
});
export type TemplateStepValues = z.infer<typeof templateStepSchema>;
