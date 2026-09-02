-- 0025_email.sql
-- Email integration: connect a per-workspace business mailbox (SMTP for
-- sending, IMAP for reading) and keep a durable log of messages sent from the
-- CRM. Mirrors the encrypted-secret pattern of workspace_apollo_settings
-- (0022): the mailbox password is encrypted at the application layer
-- (src/lib/security/secret-box.ts) before storage, with an unencrypted
-- `email_preview` kept for masked display.
--
-- Phase 1 (this migration) supports basic SMTP/IMAP auth with an app password.
-- The nullable `oauth_provider` / `encrypted_oauth_tokens` columns and the
-- `auth_type` flag are reserved so a later "Sign in with Google/Microsoft"
-- OAuth flow needs no schema change.

-- ---------------------------------------------------------------------------
-- Connection settings (one shared mailbox per workspace)
-- ---------------------------------------------------------------------------
create table public.workspace_email_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  from_name text,
  from_email text not null,
  auth_type text not null default 'basic' check (auth_type in ('basic', 'oauth')),
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean not null default true,
  imap_host text,
  imap_port integer,
  imap_secure boolean not null default true,
  encrypted_password text,
  -- Reserved for the phase-2 OAuth flow; unused while auth_type = 'basic'.
  oauth_provider text,
  encrypted_oauth_tokens text,
  email_preview text not null,
  last_verified_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.workspace_email_settings enable row level security;

-- Connecting/editing the mailbox is a workspace-admin action, so it reuses the
-- settings.update permission (same as the AI and Apollo key settings).
create policy "workspace_email_settings_select" on public.workspace_email_settings
  for select using (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_email_settings_insert" on public.workspace_email_settings
  for insert with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_email_settings_update" on public.workspace_email_settings
  for update using (public.has_permission(workspace_id, 'settings.update'))
  with check (public.has_permission(workspace_id, 'settings.update'));

create policy "workspace_email_settings_delete" on public.workspace_email_settings
  for delete using (public.has_permission(workspace_id, 'settings.update'));

-- ---------------------------------------------------------------------------
-- Sent-message log. Inbound mail is fetched live from IMAP on demand and is
-- not stored here; this table is the durable record of what the CRM sent, and
-- links a message to a company/contact/deal (same nullable-FK shape as
-- activities) so email becomes first-class CRM history.
-- ---------------------------------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  message_id text,
  in_reply_to text,
  subject text,
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  bcc_emails text[] not null default '{}',
  body_text text,
  body_html text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  created_by uuid references public.profiles(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index emails_workspace_idx on public.emails(workspace_id, created_at desc);
create index emails_contact_idx on public.emails(contact_id);
create index emails_company_idx on public.emails(company_id);
create index emails_deal_idx on public.emails(deal_id);

alter table public.emails enable row level security;

create policy "emails_select" on public.emails
  for select using (public.has_permission(workspace_id, 'email.view'));

create policy "emails_insert" on public.emails
  for insert with check (public.has_permission(workspace_id, 'email.send'));

create policy "emails_delete" on public.emails
  for delete using (public.has_permission(workspace_id, 'email.send'));

-- ---------------------------------------------------------------------------
-- Permission catalog (mirrors supabase/seed.sql). email.view lets a member
-- open the mailbox and read sent/received mail; email.send lets them compose
-- and send. Both are granted to every workspace's default role below so the
-- feature works out of the box (owners are full-access already). Connecting
-- the mailbox is gated separately by settings.update.
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('email.view', 'View the mailbox & sent email'),
  ('email.send', 'Compose & send email')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, k.key, true
from public.roles r
cross join (values ('email.view'), ('email.send')) as k(key)
where r.is_default
on conflict (role_id, permission_key) do nothing;
