-- 0028_audit_log.sql
-- Admin audit log: settings, permissions, tokens, roles — anything that isn't
-- already in the user-facing `activities` timeline. Distinct table so a Read-
-- only member can still see their CRM activity but not the admin trail.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_workspace_idx
  on public.audit_logs(workspace_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_user_id);

alter table public.audit_logs enable row level security;

-- Only members with audit.view can read; anyone in the workspace can insert
-- (server actions call it; the client never does).
create policy "audit_select" on public.audit_logs
  for select using (public.has_permission(workspace_id, 'audit.view'));
create policy "audit_insert" on public.audit_logs
  for insert with check (public.is_workspace_member(workspace_id));

-- Register the permission.
insert into public.permissions (key, description) values
  ('audit.view', 'View the workspace audit log')
on conflict (key) do update set description = excluded.description;

-- audit.view is intentionally NOT granted to the default role — Owner /
-- Admin only. Owner rows get it here for every workspace that already exists.
insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, 'audit.view', true
from public.roles r
where r.name in ('Owner', 'Admin')
on conflict (role_id, permission_key) do nothing;
