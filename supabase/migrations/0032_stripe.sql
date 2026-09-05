-- 0032_stripe.sql
-- Stripe wiring for the billing engine. Kept behind a per-workspace flag —
-- rows are only meaningful when workspace_billing_settings.stripe_enabled.
--
-- The secret key is stored as an aes-256-gcm blob via secret-box; the
-- publishable key is public and stored in plaintext. Webhook secret is
-- also stored plain so `Stripe-Signature` HMAC verification can read it.

create table public.workspace_billing_settings (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  stripe_enabled boolean not null default false,
  stripe_publishable_key text,
  encrypted_stripe_secret_key text,
  webhook_secret text,
  webhook_endpoint_slug text unique,
  auto_invoice_on_won boolean not null default false,
  send_dunning boolean not null default true,
  dunning_schedule_days integer[] not null default '{3,7,14}',
  tax_inclusive boolean not null default false,
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspace_billing_settings_updated_at
  before update on public.workspace_billing_settings
  for each row execute function public.set_updated_at();

-- Recurring subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric(14, 3) not null default 1,
  currency text not null default 'GBP',
  interval text not null check (interval in ('day','week','month','year')),
  external_ref text,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'paused')),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_workspace_idx on public.subscriptions(workspace_id);
create index subscriptions_company_idx on public.subscriptions(company_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Idempotency ledger for incoming Stripe webhooks. UNIQUE on (workspace_id,
-- external_id) means the same event replayed does nothing on second insert.
create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index stripe_events_workspace_external_key
  on public.stripe_events(workspace_id, external_id);

-- RLS
alter table public.workspace_billing_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

create policy "workspace_billing_settings_select" on public.workspace_billing_settings
  for select using (public.has_permission(workspace_id, 'billing.view'));
create policy "workspace_billing_settings_write" on public.workspace_billing_settings
  for all using (public.has_permission(workspace_id, 'settings.update'))
  with check (public.has_permission(workspace_id, 'settings.update'));

create policy "subscriptions_select" on public.subscriptions
  for select using (public.has_permission(workspace_id, 'billing.view'));
create policy "subscriptions_write" on public.subscriptions
  for all using (public.has_permission(workspace_id, 'billing.update'))
  with check (public.has_permission(workspace_id, 'billing.update'));

create policy "stripe_events_select" on public.stripe_events
  for select using (public.has_permission(workspace_id, 'billing.view'));
-- Writes to stripe_events come exclusively from the webhook via the admin
-- client; no session-side policies granted.
