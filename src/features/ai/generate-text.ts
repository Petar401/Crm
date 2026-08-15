import "server-only";

import { createAiClient } from "@/features/ai/client";
import { AI_PROVIDERS } from "@/features/ai/providers";
import type { AiCredentials } from "@/features/ai/settings-queries";

/**
 * Runs a single-turn generation server-side using the given provider
 * credentials. The key never leaves the server.
 */
export async function generateText(
  prompt: string,
  systemInstruction: string,
  credentials: AiCredentials
): Promise<string> {
  const client = createAiClient(credentials.provider, credentials.apiKey);
  const model =
    credentials.model ?? AI_PROVIDERS[credentials.provider].defaultModel;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0].message.content?.trim() ?? "";
}
