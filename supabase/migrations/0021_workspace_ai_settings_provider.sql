-- 0021_workspace_ai_settings_provider.sql
-- Generalizes the per-workspace AI key (0020_workspace_ai_settings.sql) beyond
-- Groq: adds a provider selector and an optional model override so a
-- workspace can point AI features at any supported OpenAI-compatible
-- provider (currently Groq or OpenRouter, which itself proxies many free
-- models such as Nvidia Nemotron).

alter table public.workspace_ai_settings
  add column provider text not null default 'groq' check (provider in ('groq', 'openrouter')),
  add column model text;
