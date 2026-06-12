-- 0011_lead_automation.sql
-- Lead-finder automation: campaigns that discover businesses from a free source
-- (OpenStreetMap / Overpass), score them with AI, and either queue them for
-- review or auto-create Company + Contact records.
--
-- Mirrors the table + RLS pattern in 0002_crm_core.sql / 0005_rls.sql.

-- ---------------------------------------------------------------------------
-- lead_campaigns: the automation configuration
-- ---------------------------------------------------------------------------
create table public.lead_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  business_description text not null default '',
  target_categories text[] not null default '{}',
  location text,
  country text,
  frequency text check (frequency in ('manual','daily','weekly')) default 'manual',
  -- The review-queue vs auto-create toggle: when true, discovered leads become
  -- Company (+ Contact) records immediately; otherwise they wait in the queue.
  auto_create boolean not null default false,
  max_results int not null default 25,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_count int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_campaigns_workspace_idx on public.lead_campaigns(workspace_id);

-- ---------------------------------------------------------------------------
-- leads: discovered candidates / review queue
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.lead_campaigns(id) on delete cascade,
  company_name text not null,
  website text,
  phone text,
  email text,
  address_line_1 text,
  city text,
  country text,
  industry text,
  contact_name text,
  contact_email text,
  contact_phone text,
  job_title text,
  source text not null default 'openstreetmap',
  source_ref text,
  match_score int,
  match_reason text,
  status text check (status in ('pending','approved','rejected','converted')) default 'pending',
  converted_company_id uuid references public.companies(id) on delete set null,
  converted_contact_id uuid references public.contacts(id) on delete set null,
  raw jsonb,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index leads_workspace_idx on public.leads(workspace_id);
create index leads_campaign_idx on public.leads(campaign_id);
-- Dedupe lookups: skip OSM elements already imported into this workspace.
create unique index leads_source_ref_idx
  on public.leads(workspace_id, source_ref)
  where source_ref is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.lead_campaigns enable row level security;
alter table public.leads enable row level security;

create policy "lead_campaigns_select" on public.lead_campaigns
  for select using (public.has_permission(workspace_id, 'leads.view'));
create policy "lead_campaigns_insert" on public.lead_campaigns
  for insert with check (public.has_permission(workspace_id, 'leads.create'));
create policy "lead_campaigns_update" on public.lead_campaigns
  for update using (public.has_permission(workspace_id, 'leads.update'))
  with check (public.has_permission(workspace_id, 'leads.update'));
create policy "lead_campaigns_delete" on public.lead_campaigns
  for delete using (public.has_permission(workspace_id, 'leads.delete'));

create policy "leads_select" on public.leads
  for select using (public.has_permission(workspace_id, 'leads.view'));
create policy "leads_insert" on public.leads
  for insert with check (public.has_permission(workspace_id, 'leads.create'));
create policy "leads_update" on public.leads
  for update using (public.has_permission(workspace_id, 'leads.update'))
  with check (public.has_permission(workspace_id, 'leads.update'));
create policy "leads_delete" on public.leads
  for delete using (public.has_permission(workspace_id, 'leads.delete'));

-- ---------------------------------------------------------------------------
-- Permission catalog + default-role grants (mirrors supabase/seed.sql)
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('leads.view',   'View lead campaigns & discovered leads'),
  ('leads.create', 'Create campaigns & run lead discovery'),
  ('leads.update', 'Edit campaigns & review/approve leads'),
  ('leads.delete', 'Delete campaigns & leads')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, p.key, true
from public.roles r
cross join public.permissions p
where r.is_default
  and p.key in ('leads.view','leads.create','leads.update')
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Scheduling extensions (free on all Supabase plans). The actual cron job is
-- installed manually because it needs the deployed app URL + CRON_SECRET, which
-- are environment-specific. After deploying, run (in the SQL editor):
--
--   select cron.schedule('run-lead-campaigns', '0 * * * *', $$
--     select net.http_post(
--       url := 'https://YOUR_APP_URL/api/cron/leads',
--       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
--     );
--   $$);
--
-- The route decides which campaigns are actually due (daily/weekly vs
-- last_run_at), so a single hourly entry covers every frequency.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;
