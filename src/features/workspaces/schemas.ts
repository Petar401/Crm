import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  industry: z.string().max(60).optional(),
  timezone: z.string().min(1).default("UTC"),
  currency: z.string().min(3).max(3).default("USD"),
  locale: z.string().min(2).max(10).default("en-US"),
});
export type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;

export const inviteToWorkspaceSchema = z.object({
  email: z.string().email(),
  roleName: z.string().optional(),
});
export type InviteToWorkspaceValues = z.infer<typeof inviteToWorkspaceSchema>;
