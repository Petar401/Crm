-- 0020_workspace_ai_settings.sql
-- Per-workspace AI provider (Groq) API key, entered from Settings. The key is
-- encrypted at the application layer before being stored (see
-- src/lib/security/secret-box.ts) — this column never holds plaintext. A
-- short unencrypted `key_preview` (last 4 chars) is kept alongside for masked
-- display, mirroring the api_tokens.token_prefix pattern (0013_api_tokens.sql).
-- When no row exists for a workspace, the app falls back to the global
-- GROQ_API_KEY env var.

create table public.workspace_ai_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  encrypted_api_key text not null,
  key_preview text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.workspace_ai_settings enable row level security;

create policy "workspace_ai_settings_select" on public.workspace_ai_settings
  for select using (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_ai_settings_insert" on public.workspace_ai_settings
  for insert with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_ai_settings_update" on public.workspace_ai_settings
  for update using (public.has_permission(workspace_id, 'settings.update'))
  with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_ai_settings_delete" on public.workspace_ai_settings
  for delete using (public.has_permission(workspace_id, 'settings.update'));
