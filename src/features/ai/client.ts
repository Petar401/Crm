import "server-only";

import Groq from "groq-sdk";

import { AI_PROVIDERS, type AiProvider } from "@/features/ai/providers";

/**
 * Builds an SDK client for the given provider. groq-sdk is generated the
 * same way as openai-node (same `.chat.completions.create()` shape), so
 * pointing it at another OpenAI-compatible endpoint via `baseURL` works for
 * providers like OpenRouter without pulling in a second SDK.
 */
export function createAiClient(provider: AiProvider, apiKey: string): Groq {
  const config = AI_PROVIDERS[provider];
  return new Groq({
    apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.headers,
  });
}
