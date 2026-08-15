"use server";

import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveAiCredentials } from "@/features/ai/settings-queries";
import { extractTextFromFile } from "@/features/ai/extract-text";
import { runAriaChat } from "@/features/aria/ai-chat";
import type { GeminiHistoryItem, ChatPart } from "@/features/aria/ai-chat";
import { getCrmContext } from "@/features/aria/queries";
import { getAttachmentsByIds } from "@/features/attachments/queries";
import { ATTACHMENT_BUCKET } from "@/features/attachments/constants";
import { createClient } from "@/lib/supabase/server";

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

/** Builds a chat part for a file: vision part for images, extracted text otherwise. */
async function fileToPart(
  bytes: Uint8Array,
  mimeType: string,
  name: string
): Promise<ChatPart> {
  if ((mimeType || "").toLowerCase().startsWith("image/")) {
    return {
      inlineData: {
        data: Buffer.from(bytes).toString("base64"),
        mimeType,
      },
    };
  }
  const text = await extractTextFromFile(bytes, mimeType, name);
  return {
    text: `\n\n--- Attached file: ${name} (${mimeType || "unknown"}) ---\n${text}\n--- End of ${name} ---`,
  };
}

export async function sendAriaMessage(
  conversationHistory: HistoryMessage[],
  userMessage: string,
  attachments?: AttachmentInput[],
  workspaceFileIds?: string[]
): Promise<AriaResult> {
  const ctx = await requireAuthContext();
  await requirePermission("ai.use");

  const credentials = await resolveAiCredentials(ctx.workspace.id);
  if (!credentials) {
    return {
      error: "AI is not configured. Add an API key in Settings.",
    };
  }

  const crm = await getCrmContext(ctx.workspace.id);

  const seedHistory: GeminiHistoryItem[] = [
    {
      role: "user",
      parts: [
        {
          text: `Here is the current CRM data for your workspace:\n\n${crm.json}`,
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

  const newParts: ChatPart[] = [{ text: userMessage || "(see attached file)" }];

  // Files attached directly in the chat (base64 payloads from the browser).
  if (attachments?.length) {
    for (const att of attachments) {
      const bytes = Buffer.from(att.data, "base64");
      newParts.push(await fileToPart(bytes, att.mimeType, att.name));
    }
  }

  // Files picked from the workspace Files section — download and read server-side.
  if (workspaceFileIds?.length) {
    const records = await getAttachmentsByIds(ctx.workspace.id, workspaceFileIds);
    const supabase = await createClient();
    for (const rec of records) {
      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .download(rec.storage_path);
      if (error || !data) {
        newParts.push({
          text: `\n\n[Could not read "${rec.file_name}" from the Files section.]`,
        });
        continue;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      newParts.push(
        await fileToPart(bytes, rec.mime_type ?? "", rec.file_name)
      );
    }
  }

  // Read-on-demand: Aria calls read_workspace_file(id) to open a listed file
  // or invoice. Resolve the id against the snapshot, download it, extract text.
  const readFile = async (id: string): Promise<string> => {
    const ref = crm.files.get(id);
    if (!ref) {
      return `[No file or invoice with id "${id}" exists in this workspace.]`;
    }
    if ((ref.mime_type || "").toLowerCase().startsWith("image/")) {
      return `["${ref.file_name}" is an image. Ask the user to attach it to the chat so it can be viewed.]`;
    }
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(ref.storage_bucket)
      .download(ref.storage_path);
    if (error || !data) {
      return `[Could not download "${ref.file_name}".]`;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    return extractTextFromFile(bytes, ref.mime_type ?? "", ref.file_name);
  };

  try {
    const message = await runAriaChat(
      seedHistory,
      geminiHistory,
      newParts,
      readFile,
      credentials
    );
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Aria request failed." };
  }
}

export interface WorkspaceFileOption {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

/** Lists the workspace's uploaded files for the Aria file picker. */
export async function listWorkspaceFilesForAria(): Promise<
  WorkspaceFileOption[]
> {
  const ctx = await requireAuthContext();
  await requirePermission("ai.use");

  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, file_size")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((a) => ({
    id: a.id as string,
    name: a.file_name as string,
    mimeType: (a.mime_type as string | null) ?? null,
    size: (a.file_size as number | null) ?? null,
  }));
}
