-- 0003_activity_files.sql
-- Tasks, notes, activity timeline, and attachment metadata.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text check (status in ('todo','in_progress','done','cancelled')) default 'todo',
  priority text check (priority in ('low','medium','high')) default 'medium',
  due_at timestamptz,
  assigned_to uuid references public.profiles(id),
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_workspace_idx on public.tasks(workspace_id);
create index tasks_assigned_idx on public.tasks(assigned_to);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  body text not null,
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_workspace_idx on public.notes(workspace_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in ('note','call','email','meeting','task_created','task_completed','stage_changed','file_uploaded')),
  title text,
  detail text,
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  actor_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index activities_workspace_idx on public.activities(workspace_id);
create index activities_company_idx on public.activities(company_id);
create index activities_deal_idx on public.activities(deal_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('company','contact','deal','note')),
  entity_id uuid not null,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index attachments_workspace_idx on public.attachments(workspace_id);
create index attachments_entity_idx on public.attachments(entity_type, entity_id);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
