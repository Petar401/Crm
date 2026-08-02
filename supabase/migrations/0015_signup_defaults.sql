-- 0015_signup_defaults.sql
-- Close the "signup grants full workspace access" hole (audit A1).
--
-- Before this migration, `join_or_create_shared_workspace()` inserted every
-- new user into the single shared workspace with `is_full_access = true`,
-- which meant anyone who could reach /signup instantly received `team.edit_roles`,
-- `settings.*`, `files.*` etc. across the whole tenant.
--
-- After this migration:
--   * The very first user of the workspace still bootstraps it and stays full
--     access (that path goes through create_workspace_for_user()).
--   * Every subsequent joiner is inserted with `is_full_access = false` and
--     falls back to the workspace's default role for their permissions.
--
-- Existing members are intentionally left alone — flipping `is_full_access`
-- for currently trusted teammates would be a surprising behaviour change and
-- would lock out the workspace's admins. The workspace owner should demote
-- any specific members manually from Settings.

create or replace function public.join_or_create_shared_workspace(workspace_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_role uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- The shared workspace is the oldest one.
  select id into v_workspace from public.workspaces order by created_at asc limit 1;

  -- First user ever: bootstrap the workspace (reuses the existing logic which
  -- also creates the default role and sales pipeline). The bootstrapper keeps
  -- full access — they need to be able to invite / configure permissions.
  if v_workspace is null then
    return public.create_workspace_for_user(
      coalesce(nullif(trim(workspace_name), ''), 'Workspace')
    );
  end if;

  -- Everyone else joins the shared workspace as a *scoped* member: they get
  -- the default role's permissions, but never the `is_full_access` bypass.
  select id into v_role
  from public.roles
  where workspace_id = v_workspace and is_default = true
  limit 1;

  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  values (v_workspace, v_user, 'member', v_role, false)
  on conflict (workspace_id, user_id) do nothing;

  return v_workspace;
end;
$$;

grant execute on function public.join_or_create_shared_workspace(text) to authenticated;
