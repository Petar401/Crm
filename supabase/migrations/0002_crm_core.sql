-- 0002_crm_core.sql
-- Core CRM entities: companies, contacts, pipelines, stages, deals.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  phone text,
  email text,
  address_line_1 text,
  city text,
  postcode text,
  country text,
  status text check (status in ('lead','active','customer','inactive')) default 'lead',
  owner_user_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_workspace_idx on public.companies(workspace_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  email text,
  phone text,
  job_title text,
  linkedin_url text,
  contact_role text check (contact_role in ('decision_maker','influencer','admin','other')) default 'other',
  is_primary boolean default false,
  owner_user_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_workspace_idx on public.contacts(workspace_id);
create index contacts_company_idx on public.contacts(company_id);

create table public.deal_pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_default boolean default false,
  created_at timestamptz not null default now()
);
create index deal_pipelines_workspace_idx on public.deal_pipelines(workspace_id);

create table public.deal_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pipeline_id uuid not null references public.deal_pipelines(id) on delete cascade,
  name text not null,
  position int not null,
  color text,
  unique (pipeline_id, position)
);
create index deal_stages_workspace_idx on public.deal_stages(workspace_id);
create index deal_stages_pipeline_idx on public.deal_stages(pipeline_id);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id),
  pipeline_id uuid references public.deal_pipelines(id),
  stage_id uuid references public.deal_stages(id),
  name text not null,
  value numeric(12,2),
  currency text default 'GBP',
  probability int check (probability >= 0 and probability <= 100),
  expected_close_date date,
  status text check (status in ('open','won','lost')) default 'open',
  owner_user_id uuid references public.profiles(id),
  source text,
  next_step text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_workspace_idx on public.deals(workspace_id);
create index deals_company_idx on public.deals(company_id);
create index deals_stage_idx on public.deals(stage_id);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();
