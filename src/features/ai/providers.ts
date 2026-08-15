import type { AiProvider } from "@/lib/db/types";

export type { AiProvider };

export interface ProviderConfig {
  label: string;
  /** Undefined uses groq-sdk's own default (Groq's) endpoint. */
  baseURL?: string;
  defaultModel: string;
  /** Groq only — swapped in automatically when the chat includes an image. */
  visionModel?: string;
  headers?: Record<string, string>;
  keyPlaceholder: string;
  consoleUrl: string;
}

export const AI_PROVIDERS: Record<AiProvider, ProviderConfig> = {
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    keyPlaceholder: "gsk_...",
    consoleUrl: "https://console.groq.com",
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    // Fallback only — OpenRouter workspaces are expected to pick a model.
    defaultModel: "nvidia/nemotron-nano-9b-v2:free",
    headers: {
      "X-Title": "CRM",
      ...(process.env.NEXT_PUBLIC_SITE_URL
        ? { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL }
        : {}),
    },
    keyPlaceholder: "sk-or-v1-...",
    consoleUrl: "https://openrouter.ai/keys",
  },
};
