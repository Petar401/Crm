import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content, Part } from "@google/generative-ai";

const MODEL = "gemini-2.0-flash";

const SYSTEM_INSTRUCTION = `You are Aria, a smart and helpful AI assistant embedded in a B2B sales CRM. Your team's full CRM data is provided as context at the start of each conversation.

You can help with: answering questions about companies, contacts, and deals; summarising data and providing insights; drafting emails and follow-ups; analysing pipeline health; strategic recommendations; and analysing uploaded files or images.

Be concise, professional, and actionable. Write in clear British English. When referencing CRM data, cite the specific records you draw from. Never invent facts — only use what is in the provided context or uploaded files.`;

export interface GeminiHistoryItem {
  role: "user" | "model";
  parts: Part[];
}

export async function runAriaChat(
  seedHistory: GeminiHistoryItem[],
  conversationHistory: GeminiHistoryItem[],
  newParts: Part[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI is not configured.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const chat = model.startChat({
    history: [...seedHistory, ...conversationHistory] as Content[],
  });

  const result = await chat.sendMessage(newParts);
  return result.response.text().trim();
}
