import { z } from "zod";

export const saveAiApiKeySchema = z
  .object({
    provider: z.enum(["groq", "openrouter"]),
    apiKey: z
      .string()
      .trim()
      .min(20, "That doesn't look like a valid API key")
      .max(200, "Key is too long"),
    model: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.provider !== "openrouter" || !!v.model, {
    message: "Choose a model for OpenRouter",
    path: ["model"],
  });

export type SaveAiApiKeyInput = z.infer<typeof saveAiApiKeySchema>;
