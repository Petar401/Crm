import "server-only";

import Groq from "groq-sdk";
import OpenAI from "openai";

import { AI_PROVIDERS, type AiProvider } from "@/features/ai/providers";

/**
 * Minimal shape both groq-sdk and openai-node satisfy for a single
 * non-streaming chat completion call. Declared explicitly (rather than a
 * `Groq | OpenAI` union) because both SDKs overload
 * `chat.completions.create` for streaming vs non-streaming, and a union of
 * incompatible overload sets isn't callable in TypeScript.
 */
export interface AiChatClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          messages: OpenAI.Chat.ChatCompletionMessageParam[];
          tools?: OpenAI.Chat.ChatCompletionTool[];
        },
        options?: { signal?: AbortSignal }
      ): Promise<OpenAI.Chat.ChatCompletion>;
    };
  };
}

/**
 * Builds an SDK client for the given provider.
 *
 * groq-sdk and openai-node share the same `.chat.completions.create()`
 * call shape, but NOT the same request paths: every groq-sdk resource
 * method hardcodes a `/openai/v1/...` prefix (correct for Groq's own
 * endpoint, api.groq.com/openai/v1/...), while openai-node's paths are
 * bare (e.g. `/chat/completions`). Pointing groq-sdk at OpenRouter's
 * baseURL (`https://openrouter.ai/api/v1`) therefore doubles up into a
 * nonexistent `.../api/v1/openai/v1/chat/completions` URL. So OpenRouter
 * (and any other non-Groq OpenAI-compatible provider) must use openai-node
 * instead — do not "simplify" this back to one SDK.
 */
export function createAiClient(
  provider: AiProvider,
  apiKey: string
): AiChatClient {
  const config = AI_PROVIDERS[provider];
  if (provider === "groq") {
    // groq-sdk's message/content-part types differ slightly from
    // openai-node's (e.g. an extra "document" content part variant), but
    // both accept the plain text/image_url shapes this app actually sends.
    return new Groq({ apiKey }) as unknown as AiChatClient;
  }
  return new OpenAI({
    apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.headers,
  });
}
