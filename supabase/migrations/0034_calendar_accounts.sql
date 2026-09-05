-- 0034_calendar_accounts.sql
-- Per-user calendar sync accounts. Tokens are stored as an aes-256-gcm
-- secret-box blob of {access_token, refresh_token, expires_at}. RLS is
-- per-user (matching the email-accounts pattern), not workspace-shared —
-- a person's connected personal calendar is their own.

create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  external_account_email text not null,
  external_calendar_id text not null default 'primary',
  encrypted_tokens text not null,
  sync_token text,
  channel_id text,
  channel_resource_id text,
  channel_expiry timestamptz,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index calendar_accounts_user_provider_calendar_key
  on public.calendar_accounts(user_id, provider, external_calendar_id);
create index calendar_accounts_user_idx on public.calendar_accounts(user_id);
create index calendar_accounts_channel_id_idx
  on public.calendar_accounts(channel_id) where channel_id is not null;

create trigger calendar_accounts_updated_at before update on public.calendar_accounts
  for each row execute function public.set_updated_at();

alter table public.calendar_accounts enable row level security;

create policy "calendar_accounts_owner_select" on public.calendar_accounts
  for select using (user_id = auth.uid());
create policy "calendar_accounts_owner_write" on public.calendar_accounts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- OAuth state (short-lived; used across authorize → callback).
-- ---------------------------------------------------------------------------
create table public.calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  state text not null unique,
  code_verifier text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index calendar_oauth_states_user_idx on public.calendar_oauth_states(user_id);

alter table public.calendar_oauth_states enable row level security;
create policy "calendar_oauth_states_owner_select" on public.calendar_oauth_states
  for select using (user_id = auth.uid());
-- writes flow through the callback via the admin client.
