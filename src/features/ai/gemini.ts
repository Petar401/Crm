import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.0-flash";

/** Whether AI features are configured (a Gemini key is present). */
export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Runs a single-turn Gemini generation server-side. Throws if AI is not
 * configured. The API key never leaves the server.
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
  });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
