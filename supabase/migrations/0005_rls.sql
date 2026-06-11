-- 0005_rls.sql
-- Enable Row Level Security and define workspace-scoped policies on every
-- application table, plus the attachments storage bucket and its policies.
--
-- Read access is scoped to workspace membership; write access additionally
-- requires the relevant permission via has_permission().

-- Helper: does the current user share any workspace with the given user?
create or replace function public.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them
      on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.deal_pipelines enable row level security;
alter table public.deal_stages enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.activities enable row level security;
alter table public.attachments enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_permission_overrides enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_shared" on public.profiles
  for select using (id = auth.uid() or public.shares_workspace_with(id));
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------
create policy "workspaces_select_member" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_update_priv" on public.workspaces
  for update using (
    created_by = auth.uid() or public.has_permission(id, 'settings.update')
  ) with check (
    created_by = auth.uid() or public.has_permission(id, 'settings.update')
  );

-- ---------------------------------------------------------------------------
-- Workspace members
-- ---------------------------------------------------------------------------
create policy "members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "members_insert" on public.workspace_members
  for insert with check (public.has_permission(workspace_id, 'team.invite'));
create policy "members_update" on public.workspace_members
  for update using (public.has_permission(workspace_id, 'team.edit_roles'))
  with check (public.has_permission(workspace_id, 'team.edit_roles'));
create policy "members_delete" on public.workspace_members
  for delete using (public.has_permission(workspace_id, 'team.edit_roles'));

-- ---------------------------------------------------------------------------
-- Permissions catalog (read-only reference for any authenticated user)
-- ---------------------------------------------------------------------------
create policy "permissions_select_all" on public.permissions
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Roles & role permissions
-- ---------------------------------------------------------------------------
create policy "roles_select" on public.roles
  for select using (public.is_workspace_member(workspace_id));
create policy "roles_write" on public.roles
  for all using (public.has_permission(workspace_id, 'team.edit_roles'))
  with check (public.has_permission(workspace_id, 'team.edit_roles'));

create policy "role_permissions_select" on public.role_permissions
  for select using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
create policy "role_permissions_write" on public.role_permissions
  for all using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.workspace_id, 'team.edit_roles')
    )
  ) with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.workspace_id, 'team.edit_roles')
    )
  );

-- ---------------------------------------------------------------------------
-- Member permission overrides
-- ---------------------------------------------------------------------------
create policy "overrides_select" on public.member_permission_overrides
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.id = member_permission_overrides.workspace_member_id
        and public.is_workspace_member(m.workspace_id)
    )
  );
create policy "overrides_write" on public.member_permission_overrides
  for all using (
    exists (
      select 1 from public.workspace_members m
      where m.id = member_permission_overrides.workspace_member_id
        and public.has_permission(m.workspace_id, 'team.edit_roles')
    )
  ) with check (
    exists (
      select 1 from public.workspace_members m
      where m.id = member_permission_overrides.workspace_member_id
        and public.has_permission(m.workspace_id, 'team.edit_roles')
    )
  );

-- ---------------------------------------------------------------------------
-- CRM entity policies (uniform pattern). Reads require membership; writes
-- require the matching <module>.<action> permission.
-- ---------------------------------------------------------------------------

-- Companies
create policy "companies_select" on public.companies
  for select using (public.has_permission(workspace_id, 'companies.view'));
create policy "companies_insert" on public.companies
  for insert with check (public.has_permission(workspace_id, 'companies.create'));
create policy "companies_update" on public.companies
  for update using (public.has_permission(workspace_id, 'companies.update'))
  with check (public.has_permission(workspace_id, 'companies.update'));
create policy "companies_delete" on public.companies
  for delete using (public.has_permission(workspace_id, 'companies.delete'));

-- Contacts
create policy "contacts_select" on public.contacts
  for select using (public.has_permission(workspace_id, 'contacts.view'));
create policy "contacts_insert" on public.contacts
  for insert with check (public.has_permission(workspace_id, 'contacts.create'));
create policy "contacts_update" on public.contacts
  for update using (public.has_permission(workspace_id, 'contacts.update'))
  with check (public.has_permission(workspace_id, 'contacts.update'));
create policy "contacts_delete" on public.contacts
  for delete using (public.has_permission(workspace_id, 'contacts.delete'));

-- Deal pipelines & stages (viewable with deals.view; managed with deals.update)
create policy "pipelines_select" on public.deal_pipelines
  for select using (public.has_permission(workspace_id, 'deals.view'));
create policy "pipelines_write" on public.deal_pipelines
  for all using (public.has_permission(workspace_id, 'deals.update'))
  with check (public.has_permission(workspace_id, 'deals.update'));

create policy "stages_select" on public.deal_stages
  for select using (public.has_permission(workspace_id, 'deals.view'));
create policy "stages_write" on public.deal_stages
  for all using (public.has_permission(workspace_id, 'deals.update'))
  with check (public.has_permission(workspace_id, 'deals.update'));

-- Deals
create policy "deals_select" on public.deals
  for select using (public.has_permission(workspace_id, 'deals.view'));
create policy "deals_insert" on public.deals
  for insert with check (public.has_permission(workspace_id, 'deals.create'));
create policy "deals_update" on public.deals
  for update using (public.has_permission(workspace_id, 'deals.update'))
  with check (public.has_permission(workspace_id, 'deals.update'));
create policy "deals_delete" on public.deals
  for delete using (public.has_permission(workspace_id, 'deals.delete'));

-- Tasks
create policy "tasks_select" on public.tasks
  for select using (public.has_permission(workspace_id, 'tasks.view'));
create policy "tasks_insert" on public.tasks
  for insert with check (public.has_permission(workspace_id, 'tasks.create'));
create policy "tasks_update" on public.tasks
  for update using (public.has_permission(workspace_id, 'tasks.update'))
  with check (public.has_permission(workspace_id, 'tasks.update'));
create policy "tasks_delete" on public.tasks
  for delete using (public.has_permission(workspace_id, 'tasks.delete'));

-- Notes
create policy "notes_select" on public.notes
  for select using (public.has_permission(workspace_id, 'notes.view'));
create policy "notes_insert" on public.notes
  for insert with check (public.has_permission(workspace_id, 'notes.create'));
create policy "notes_update" on public.notes
  for update using (public.has_permission(workspace_id, 'notes.update'))
  with check (public.has_permission(workspace_id, 'notes.update'));
create policy "notes_delete" on public.notes
  for delete using (public.has_permission(workspace_id, 'notes.delete'));

-- Activities (readable by members; inserted by app server actions)
create policy "activities_select" on public.activities
  for select using (public.is_workspace_member(workspace_id));
create policy "activities_insert" on public.activities
  for insert with check (public.is_workspace_member(workspace_id));

-- Attachments metadata
create policy "attachments_select" on public.attachments
  for select using (public.has_permission(workspace_id, 'files.view'));
create policy "attachments_insert" on public.attachments
  for insert with check (public.has_permission(workspace_id, 'files.upload'));
create policy "attachments_delete" on public.attachments
  for delete using (public.has_permission(workspace_id, 'files.delete'));

-- ---------------------------------------------------------------------------
-- Storage: private "attachments" bucket. Object path is
-- <workspace_id>/<entity_type>/<entity_id>/<uuid>-<filename>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'files.view')
  );
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'files.upload')
  );
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'files.delete')
  );
