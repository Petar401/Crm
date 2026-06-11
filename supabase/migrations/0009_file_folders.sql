-- 0008_file_folders.sql
-- Adds a workspace-level file manager: nestable folders plus standalone
-- ("workspace") files that can be grouped into them. Per-record attachments
-- (company/contact/deal/note) keep working unchanged.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folders_workspace_idx on public.folders(workspace_id);
create index folders_parent_idx on public.folders(parent_id);

create trigger folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

-- Allow attachments to live in the workspace-level file manager. A standalone
-- file uses entity_type 'workspace' with entity_id = the workspace id, and may
-- optionally belong to a folder.
alter table public.attachments
  drop constraint attachments_entity_type_check;
alter table public.attachments
  add constraint attachments_entity_type_check
  check (entity_type in ('company','contact','deal','note','workspace'));

alter table public.attachments
  add column folder_id uuid references public.folders(id) on delete set null;
create index attachments_folder_idx on public.attachments(folder_id);

-- ---------------------------------------------------------------------------
-- RLS: folders follow the same files.* permission model as attachments.
-- ---------------------------------------------------------------------------
alter table public.folders enable row level security;

create policy "folders_select" on public.folders
  for select using (public.has_permission(workspace_id, 'files.view'));
create policy "folders_insert" on public.folders
  for insert with check (public.has_permission(workspace_id, 'files.upload'));
create policy "folders_update" on public.folders
  for update using (public.has_permission(workspace_id, 'files.upload'))
  with check (public.has_permission(workspace_id, 'files.upload'));
create policy "folders_delete" on public.folders
  for delete using (public.has_permission(workspace_id, 'files.delete'));
