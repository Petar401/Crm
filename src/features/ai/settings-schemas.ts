import { z } from "zod";

export const saveAiApiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "That doesn't look like a valid API key")
    .max(200, "Key is too long"),
});

export type SaveAiApiKeyInput = z.infer<typeof saveAiApiKeySchema>;
