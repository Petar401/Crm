import { z } from "zod";

export const createApiTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the token a name")
    .max(80, "Keep the name under 80 characters"),
});

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

export const TOKEN_PLAINTEXT_PREFIX = "crm_pat_";
