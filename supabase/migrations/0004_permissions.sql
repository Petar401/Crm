-- 0004_permissions.sql
-- Permission catalog, role templates, per-member overrides, and the
-- has_permission() resolver used by both RLS and the application layer.

create table public.permissions (
  key text primary key,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_default boolean default false,
  unique (workspace_id, name)
);
create index roles_workspace_idx on public.roles(workspace_id);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null default true,
  unique (role_id, permission_key)
);

create table public.member_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null,
  unique (workspace_member_id, permission_key)
);

-- ---------------------------------------------------------------------------
-- has_permission: resolves whether the current user holds a permission in a
-- workspace, following: full access -> member override -> role -> default deny.
-- SECURITY DEFINER so it can read membership/permission tables inside policies.
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(p_workspace_id uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member public.workspace_members%rowtype;
  v_override boolean;
  v_role boolean;
begin
  select * into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid();

  if not found then
    return false;
  end if;

  if v_member.is_full_access then
    return true;
  end if;

  -- Direct member override wins.
  select allowed into v_override
  from public.member_permission_overrides
  where workspace_member_id = v_member.id
    and permission_key = p_key;

  if found then
    return v_override;
  end if;

  -- Fall back to the assigned role.
  if v_member.role_id is not null then
    select allowed into v_role
    from public.role_permissions
    where role_id = v_member.role_id
      and permission_key = p_key;

    if found then
      return v_role;
    end if;
  end if;

  return false;
end;
$$;
