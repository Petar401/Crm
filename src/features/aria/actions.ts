"use server";

import type { Part } from "@google/generative-ai";

import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { runAriaChat } from "@/features/aria/gemini-chat";
import type { GeminiHistoryItem } from "@/features/aria/gemini-chat";
import { getCrmContext } from "@/features/aria/queries";

export interface HistoryMessage {
  role: "user" | "model";
  content: string;
}

export interface AttachmentInput {
  data: string;
  mimeType: string;
  name: string;
}

export interface AriaResult {
  message?: string;
  error?: string;
}

export async function sendAriaMessage(
  conversationHistory: HistoryMessage[],
  userMessage: string,
  attachments?: AttachmentInput[]
): Promise<AriaResult> {
  if (!isAiConfigured()) {
    return {
      error: "AI is not configured. Add a GEMINI_API_KEY to enable Aria.",
    };
  }

  const ctx = await requireAuthContext();
  await requirePermission("ai.use");

  const crmJson = await getCrmContext(ctx.workspace.id);

  const seedHistory: GeminiHistoryItem[] = [
    {
      role: "user",
      parts: [
        {
          text: `Here is the current CRM data for your workspace:\n\n${crmJson}`,
        },
      ],
    },
    {
      role: "model",
      parts: [
        {
          text: "Thank you. I have your CRM data loaded and I'm ready to help.",
        },
      ],
    },
  ];

  const geminiHistory: GeminiHistoryItem[] = conversationHistory.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const newParts: Part[] = [{ text: userMessage || "(see attached file)" }];
  if (attachments?.length) {
    for (const att of attachments) {
      newParts.push({
        inlineData: { data: att.data, mimeType: att.mimeType },
      });
    }
  }

  try {
    const message = await runAriaChat(seedHistory, geminiHistory, newParts);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Aria request failed." };
  }
}
