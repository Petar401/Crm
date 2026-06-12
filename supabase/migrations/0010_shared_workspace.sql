-- 0010_shared_workspace.sql
-- Convert the CRM to a single shared workspace that every user joins, so all
-- members see the same companies, contacts, deals, tasks, notes, files, etc.
--
-- Previously each signup created its own isolated workspace via
-- create_workspace_for_user(), so newly registered users could not see data
-- created by other users. This migration:
--   A. adds join_or_create_shared_workspace() for signup/onboarding to call, and
--   B. consolidates all existing users and data into the oldest workspace, then
--      removes the now-empty duplicate workspaces.

-- A. Join (or, for the very first user, create) the single shared workspace.
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
  -- also creates the default role and sales pipeline).
  if v_workspace is null then
    return public.create_workspace_for_user(
      coalesce(nullif(trim(workspace_name), ''), 'Workspace')
    );
  end if;

  -- Everyone else joins the shared workspace as a full-access member.
  select id into v_role
  from public.roles
  where workspace_id = v_workspace and is_default = true
  limit 1;

  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  values (v_workspace, v_user, 'member', v_role, true)
  on conflict (workspace_id, user_id) do nothing;

  return v_workspace;
end;
$$;

grant execute on function public.join_or_create_shared_workspace(text) to authenticated;

-- B. One-time consolidation of existing data into the oldest workspace.
do $$
declare
  v_canonical uuid;
  v_role uuid;
  v_pipeline uuid;
  v_stage uuid;
begin
  select id into v_canonical from public.workspaces order by created_at asc limit 1;
  if v_canonical is null then
    return; -- nothing to consolidate
  end if;

  select id into v_role
  from public.roles
  where workspace_id = v_canonical and is_default = true
  limit 1;

  -- Reassign all workspace-scoped data to the canonical workspace.
  update public.companies      set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.contacts       set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.tasks          set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.notes          set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.activities     set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.attachments    set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.folders        set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.note_folders   set workspace_id = v_canonical where workspace_id <> v_canonical;
  update public.notebook_notes set workspace_id = v_canonical where workspace_id <> v_canonical;

  -- Deals: move them to canonical, but remap any pipeline/stage references to the
  -- canonical default pipeline so they survive the duplicate-pipeline cleanup
  -- below. (Duplicate workspaces are normally empty, so this is usually a no-op.)
  if exists (select 1 from public.deals where workspace_id <> v_canonical) then
    select p.id into v_pipeline
    from public.deal_pipelines p
    where p.workspace_id = v_canonical
    order by p.is_default desc, p.created_at asc
    limit 1;

    select s.id into v_stage
    from public.deal_stages s
    where s.pipeline_id = v_pipeline
    order by s.position asc
    limit 1;

    update public.deals
    set workspace_id = v_canonical,
        pipeline_id = v_pipeline,
        stage_id = v_stage
    where workspace_id <> v_canonical;
  end if;

  -- Move every user who is not yet in the canonical workspace into it.
  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  select v_canonical, wm.user_id, 'member', v_role, true
  from public.workspace_members wm
  where wm.workspace_id <> v_canonical
  on conflict (workspace_id, user_id) do nothing;

  -- Drop memberships in the non-canonical workspaces.
  delete from public.workspace_members where workspace_id <> v_canonical;

  -- Delete the now-empty duplicate workspaces. This cascades their leftover
  -- roles, pipelines, and stages.
  delete from public.workspaces where id <> v_canonical;
end $$;
