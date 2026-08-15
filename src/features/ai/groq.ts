import "server-only";

import Groq from "groq-sdk";

const MODEL = "llama-3.3-70b-versatile";

/**
 * Runs a single-turn generation server-side via Groq using the given API
 * key. The key never leaves the server.
 */
export async function generateText(
  prompt: string,
  systemInstruction: string,
  apiKey: string
): Promise<string> {
  const groq = new Groq({ apiKey });
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt },
  ];

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
  });

  return completion.choices[0].message.content?.trim() ?? "";
}
