"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Paperclip, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  sendAriaMessage,
  type AttachmentInput,
  type HistoryMessage,
} from "@/features/aria/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatAttachment {
  name: string;
  mimeType: string;
  previewUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  attachments?: ChatAttachment[];
  loading?: boolean;
  error?: boolean;
}

interface PendingFile {
  file: File;
  base64: string;
  previewUrl?: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the data URL prefix (e.g. "data:image/png;base64,")
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AriaChat({
  aiEnabled,
  userName,
}: {
  aiEnabled: boolean;
  userName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const oversized = files.filter((f) => f.size > MAX_SIZE);
    if (oversized.length) {
      toast.error(
        `File${oversized.length > 1 ? "s" : ""} too large (max 5 MB): ${oversized.map((f) => f.name).join(", ")}`
      );
    }

    const valid = files.filter((f) => f.size <= MAX_SIZE);
    const newPending = await Promise.all(
      valid.map(async (file) => {
        const base64 = await readFileAsBase64(file);
        const previewUrl = file.type.startsWith("image/")
          ? await readFileAsDataUrl(file)
          : undefined;
        return { file, base64, previewUrl };
      })
    );

    setPendingFiles((prev) => [...prev, ...newPending]);
    // reset the input so the same file can be re-selected
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    if (isLoading) return;

    const attachments: ChatAttachment[] = pendingFiles.map((pf) => ({
      name: pf.file.name,
      mimeType: pf.file.type,
      previewUrl: pf.previewUrl,
    }));

    const attachmentInputs: AttachmentInput[] = pendingFiles.map((pf) => ({
      data: pf.base64,
      mimeType: pf.file.type,
      name: pf.file.name,
    }));

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachments: attachments.length ? attachments : undefined,
    };

    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "model",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setPendingFiles([]);
    setIsLoading(true);

    // history = all prior settled messages; userMsg is the current turn sent via sendAriaMessage
    const history: HistoryMessage[] = messages
      .filter((m) => !m.loading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    startTransition(async () => {
      const result = await sendAriaMessage(history, text, attachmentInputs);

      if (result.error) {
        toast.error(result.error);
        setMessages((prev) =>
          prev.map((m) =>
            m.loading ? { ...m, loading: false, error: true, content: result.error! } : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.loading
              ? { ...m, loading: false, content: result.message ?? "" }
              : m
          )
        );
      }
      setIsLoading(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = !isLoading && (input.trim().length > 0 || pendingFiles.length > 0);

  if (!aiEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <Bot className="text-muted-foreground size-7" />
        </div>
        <div>
          <p className="font-medium">Aria is not available</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Either the Gemini API key is not configured or you don&apos;t have
            permission to use AI features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
              <Sparkles className="text-primary size-8" />
            </div>
            <div>
              <p className="text-lg font-semibold">
                Hi{userName ? `, ${userName.split(" ")[0]}` : ""}! I&apos;m Aria
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Your AI assistant for this CRM. Ask me about companies,
                contacts, deals, tasks — or upload a file for analysis.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {[
                "How many open deals do we have?",
                "Summarise our pipeline",
                "Which tasks are overdue?",
                "List our top companies",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 text-xs transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t px-4 py-2">
          {pendingFiles.map((pf, i) => (
            <div
              key={i}
              className="bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            >
              {pf.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pf.previewUrl}
                  alt={pf.file.name}
                  className="size-5 rounded object-cover"
                />
              ) : (
                <Paperclip className="size-3" />
              )}
              <span className="max-w-[120px] truncate">{pf.file.name}</span>
              <button
                onClick={() => removePendingFile(i)}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 border-t p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0"
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <Paperclip className="size-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Aria anything… (Shift+Enter for new line)"
          className="min-h-[44px] max-h-40 resize-none"
          rows={1}
          disabled={isLoading}
        />
        <Button
          type="button"
          size="icon"
          className="shrink-0"
          disabled={!canSend}
          onClick={handleSend}
          title="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-1">
          {message.attachments?.map((att, i) =>
            att.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={att.previewUrl}
                alt={att.name}
                className="ml-auto max-h-48 rounded-lg object-cover"
              />
            ) : (
              <div
                key={i}
                className="bg-muted ml-auto flex items-center gap-1.5 rounded-md px-3 py-2 text-xs"
              >
                <Paperclip className="size-3 shrink-0" />
                <span className="truncate">{att.name}</span>
              </div>
            )
          )}
          {message.content && (
            <div className="bg-primary text-primary-foreground ml-auto w-fit rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="text-primary size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {message.loading ? (
          <div className="bg-muted w-fit rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1">
              <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
              <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
              <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
            </div>
          </div>
        ) : (
          <div
            className={`w-fit max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm ${
              message.error
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}
