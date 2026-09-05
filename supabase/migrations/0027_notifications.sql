-- 0027_notifications.sql
-- In-app notifications: per-user recipient rows + per-user preferences.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx
  on public.notifications(user_id, read_at nulls first, created_at desc);
create index if not exists notifications_workspace_idx
  on public.notifications(workspace_id);

alter table public.notifications enable row level security;

-- A user can only see and mutate rows addressed to them.
create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications_insert_member" on public.notifications
  for insert with check (public.is_workspace_member(workspace_id));
create policy "notifications_delete_self" on public.notifications
  for delete using (user_id = auth.uid());

-- Per-user, per-workspace preferences for each kind.
create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id, kind)
);
alter table public.notification_preferences enable row level security;

create policy "notif_prefs_select_self" on public.notification_preferences
  for select using (user_id = auth.uid());
create policy "notif_prefs_write_self" on public.notification_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Register the new permission so it survives cross-workspace reads.
insert into public.permissions (key, description) values
  ('notifications.view', 'View your notifications')
on conflict (key) do update set description = excluded.description;

-- Grant to every existing default role so existing users are not silently
-- locked out of their own bell.
insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, 'notifications.view', true
from public.roles r
where r.is_default
on conflict (role_id, permission_key) do nothing;
