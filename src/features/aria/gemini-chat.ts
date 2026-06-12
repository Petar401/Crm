import "server-only";

import Groq from "groq-sdk";

const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_INSTRUCTION = `You are Aria, a smart and helpful AI assistant embedded in a B2B sales CRM. Your team's full CRM data is provided as context at the start of each conversation.

You can help with: answering questions about companies, contacts, and deals; summarising data and providing insights; drafting emails and follow-ups; analysing pipeline health; strategic recommendations; and analysing uploaded files or images.

Be concise, professional, and actionable. Write in clear British English. When referencing CRM data, cite the specific records you draw from. Never invent facts — only use what is in the provided context or uploaded files.`;

export interface ChatPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

/** Kept as GeminiHistoryItem for interface stability with actions.ts */
export interface GeminiHistoryItem {
  role: "user" | "model";
  parts: ChatPart[];
}

export async function runAriaChat(
  seedHistory: GeminiHistoryItem[],
  conversationHistory: GeminiHistoryItem[],
  newParts: ChatPart[]
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI is not configured.");

  const allHistory = [...seedHistory, ...conversationHistory];
  const hasImages = newParts.some(
    (p) => p.inlineData?.mimeType.startsWith("image/")
  );
  const model = hasImages ? VISION_MODEL : TEXT_MODEL;

  // Convert history to Groq's OpenAI-compatible format.
  // "model" role in our interface maps to "assistant" in Groq/OpenAI.
  const historyMessages: Groq.Chat.ChatCompletionMessageParam[] = allHistory.map(
    (item) => ({
      role: item.role === "model" ? ("assistant" as const) : ("user" as const),
      content: item.parts.map((p) => p.text ?? "").join(""),
    })
  );

  // Build the new user message content (text-only or multimodal)
  const newContent: Groq.Chat.ChatCompletionContentPart[] = newParts.map(
    (p) => {
      if (p.inlineData) {
        return {
          type: "image_url" as const,
          image_url: {
            url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
          },
        };
      }
      return { type: "text" as const, text: p.text ?? "" };
    }
  );

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...historyMessages,
    {
      role: "user",
      content: hasImages ? newContent : newParts.map((p) => p.text ?? "").join(""),
    },
  ];

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({ model, messages });
  return completion.choices[0].message.content?.trim() ?? "";
}
