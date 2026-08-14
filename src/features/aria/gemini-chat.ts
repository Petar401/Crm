import "server-only";

import Groq from "groq-sdk";

const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/** Safety bound on the tool-calling loop (read_workspace_file rounds). */
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_INSTRUCTION = `You are Aria, a smart and helpful AI assistant embedded in a B2B sales CRM. Your team's full CRM data is provided as context at the start of each conversation.

The context is a JSON object with these keys: companies, contacts, deals, tasks, recentActivities, notebookNotes, notes, leads, invoices, and files. It reflects the workspace live — whenever a record is added or changed it appears here on the next message, so trust it as the current state of the CRM.

You can help with: answering questions about companies, contacts, deals, tasks, notes, invoices and receipts; summarising data and providing insights; drafting emails and follow-ups; analysing pipeline health; strategic recommendations; and analysing uploaded files or images.

Reading documents: the "files" and "invoices" lists tell you which documents exist (by name and id) but not their contents. When the user asks about what is inside a specific file, invoice or receipt, call the read_workspace_file tool with that record's "id" to fetch its full text, then answer from it. Only read a file when the question actually requires its contents.

The workspace also runs an automated lead finder that discovers new businesses and lists them under "leads" in the context. You can help draft first-touch cold-outreach emails for these newly discovered leads: use the workspace's business description and the lead's details, and keep them short — a relevant hook, one line of value, and a soft call to action.

Be concise, professional, and actionable. Write in clear British English. When referencing CRM data, cite the specific records you draw from. Never invent facts — only use what is in the provided context or files you have read; in particular, never invent a contact's name.`;

const TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_workspace_file",
      description:
        "Read the full text contents of a workspace file or invoice/receipt document by its id. Use when the user asks about what is inside a specific document listed under `files` or `invoices` in the CRM context. Pass the record's `id` field.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "The id of the file or invoice record to read (from the context's `files` or `invoices` list).",
          },
        },
        required: ["id"],
      },
    },
  },
];

export interface ChatPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

/** Kept as GeminiHistoryItem for interface stability with actions.ts */
export interface GeminiHistoryItem {
  role: "user" | "model";
  parts: ChatPart[];
}

/** Reads a workspace file/invoice by id, returning its extracted text. */
export type FileReader = (id: string) => Promise<string>;

export async function runAriaChat(
  seedHistory: GeminiHistoryItem[],
  conversationHistory: GeminiHistoryItem[],
  newParts: ChatPart[],
  readFile: FileReader
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
      content: hasImages
        ? newContent
        : newParts.map((p) => p.text ?? "").join(""),
    },
  ];

  const groq = new Groq({ apiKey });

  let completion = await groq.chat.completions.create({
    model,
    messages,
    tools: TOOLS,
  });
  let choice = completion.choices[0].message;

  // Agentic loop: keep resolving read_workspace_file calls until the model
  // produces a normal answer (or we hit the safety bound).
  let round = 0;
  while (choice.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
    round++;
    messages.push({
      role: "assistant",
      content: choice.content ?? "",
      tool_calls: choice.tool_calls,
    });

    for (const call of choice.tool_calls) {
      let result: string;
      if (call.function.name === "read_workspace_file") {
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          const id = String(args.id ?? "").trim();
          result = id
            ? await readFile(id)
            : "[No file id was provided to read.]";
        } catch (e) {
          const reason = e instanceof Error ? e.message : "invalid arguments";
          result = `[Could not read the requested file: ${reason}.]`;
        }
      } else {
        result = `[Unknown tool: ${call.function.name}.]`;
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }

    completion = await groq.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
    });
    choice = completion.choices[0].message;
  }

  return choice.content?.trim() ?? "";
}
