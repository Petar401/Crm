-- 0022_apollo_settings.sql
-- Per-workspace Apollo.io API key, entered from Settings, used to import new
-- leads from Apollo's B2B search and to enrich leads already in the system
-- with verified email/phone/job-title. Mirrors workspace_ai_settings
-- (0020_workspace_ai_settings.sql): the key is encrypted at the application
-- layer (src/lib/security/secret-box.ts) before being stored, with a short
-- unencrypted `key_preview` (last 4 chars) kept alongside for masked display.
--
-- Unlike the AI key, there is deliberately no global env-var fallback: Apollo
-- is a paid, credit-metered API, so every workspace must configure its own
-- key rather than risk one workspace's usage draining a shared account.

create table public.workspace_apollo_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  encrypted_api_key text not null,
  key_preview text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.workspace_apollo_settings enable row level security;

create policy "workspace_apollo_settings_select" on public.workspace_apollo_settings
  for select using (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_apollo_settings_insert" on public.workspace_apollo_settings
  for insert with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_apollo_settings_update" on public.workspace_apollo_settings
  for update using (public.has_permission(workspace_id, 'settings.update'))
  with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_apollo_settings_delete" on public.workspace_apollo_settings
  for delete using (public.has_permission(workspace_id, 'settings.update'));

-- Auditability for enrichment: when a lead was last enriched via Apollo, and
-- by whom. The full Apollo response is stashed in leads.raw.apollo_enrichment
-- (no schema change needed there — `raw` is already jsonb).
alter table public.leads
  add column if not exists enriched_at timestamptz,
  add column if not exists enriched_by uuid references public.profiles(id);

-- ---------------------------------------------------------------------------
-- Permission catalog (mirrors supabase/seed.sql): a dedicated `leads.import`
-- permission gates Apollo search/import/enrichment, since both spend paid
-- Apollo credits — a materially different risk profile from the free
-- OpenStreetMap/manual lead operations gated by leads.create/update.
-- Deliberately NOT granted to the default role here (unlike leads.view/
-- create/update in 0011) — a workspace admin opts a role into it explicitly
-- via Settings > Team, since it can spend the workspace's Apollo credits.
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('leads.import', 'Import leads & enrich via Apollo.io (uses paid credits)')
on conflict (key) do update set description = excluded.description;
