-- 0008_notebook.sql
-- Standalone, workspace-shared Notebook: free-form notes grouped into folders,
-- used by the team to share information and research. Distinct from the
-- entity-attached `notes` table (which pins notes to a company/contact/deal).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.note_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index note_folders_workspace_idx on public.note_folders(workspace_id);

create table public.notebook_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.note_folders(id) on delete set null,
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebook_notes_workspace_idx on public.notebook_notes(workspace_id);
create index notebook_notes_folder_idx on public.notebook_notes(folder_id);

create trigger note_folders_updated_at before update on public.note_folders
  for each row execute function public.set_updated_at();
create trigger notebook_notes_updated_at before update on public.notebook_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permission catalog (idempotent; mirrors seed.sql and the app constants)
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('notebook.view',   'View shared notes'),
  ('notebook.create', 'Create shared notes & folders'),
  ('notebook.update', 'Edit shared notes & folders'),
  ('notebook.delete', 'Delete shared notes & folders')
on conflict (key) do update set description = excluded.description;

-- Grant the read/write baseline to every default "Member" role (mirrors the
-- baseline in seed.sql; destructive delete stays owner/full-access only).
insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, p.key, true
from public.roles r
cross join public.permissions p
where r.is_default
  and p.key in ('notebook.view', 'notebook.create', 'notebook.update')
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security (uniform module pattern, gated by has_permission())
-- ---------------------------------------------------------------------------
alter table public.note_folders enable row level security;
alter table public.notebook_notes enable row level security;

-- Folders
create policy "note_folders_select" on public.note_folders
  for select using (public.has_permission(workspace_id, 'notebook.view'));
create policy "note_folders_insert" on public.note_folders
  for insert with check (public.has_permission(workspace_id, 'notebook.create'));
create policy "note_folders_update" on public.note_folders
  for update using (public.has_permission(workspace_id, 'notebook.update'))
  with check (public.has_permission(workspace_id, 'notebook.update'));
create policy "note_folders_delete" on public.note_folders
  for delete using (public.has_permission(workspace_id, 'notebook.delete'));

-- Notes
create policy "notebook_notes_select" on public.notebook_notes
  for select using (public.has_permission(workspace_id, 'notebook.view'));
create policy "notebook_notes_insert" on public.notebook_notes
  for insert with check (public.has_permission(workspace_id, 'notebook.create'));
create policy "notebook_notes_update" on public.notebook_notes
  for update using (public.has_permission(workspace_id, 'notebook.update'))
  with check (public.has_permission(workspace_id, 'notebook.update'));
create policy "notebook_notes_delete" on public.notebook_notes
  for delete using (public.has_permission(workspace_id, 'notebook.delete'));
