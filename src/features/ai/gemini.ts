import "server-only";

import Groq from "groq-sdk";

const MODEL = "llama-3.3-70b-versatile";

/** Whether AI features are configured (a Groq key is present). */
export function isAiConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Runs a single-turn generation server-side via Groq. Throws if AI is not
 * configured. The API key never leaves the server.
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("AI is not configured.");
  }

  const groq = new Groq({ apiKey });
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
  });

  return completion.choices[0].message.content?.trim() ?? "";
}
