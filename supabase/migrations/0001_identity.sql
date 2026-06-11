-- 0001_identity.sql
-- Profiles, workspaces, membership, and the signup/bootstrap helpers.

-- Helper: keep updated_at fresh on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text,
  role_id uuid,
  is_full_access boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index workspace_members_workspace_idx on public.workspace_members(workspace_id);

-- ---------------------------------------------------------------------------
-- On signup, mirror the auth user into profiles.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership lookup helper used throughout RLS policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap a workspace for the current user: workspace + default pipeline,
-- stages, default role, and an owner membership with full access.
-- Runs SECURITY DEFINER so it can seed rows before any membership exists.
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace_for_user(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_pipeline uuid;
  v_role uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Unique slug from the name plus a short random suffix.
  v_slug := regexp_replace(lower(coalesce(nullif(trim(workspace_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'workspace'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.workspaces (name, slug, created_by)
  values (coalesce(nullif(trim(workspace_name), ''), 'My Workspace'), v_slug, v_user)
  returning id into v_workspace;

  -- Default role (template) for the workspace.
  insert into public.roles (workspace_id, name, is_default)
  values (v_workspace, 'Member', true)
  returning id into v_role;

  -- Owner membership: full access by default.
  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  values (v_workspace, v_user, 'owner', v_role, true);

  -- Default pipeline + stages.
  insert into public.deal_pipelines (workspace_id, name, is_default)
  values (v_workspace, 'Sales Pipeline', true)
  returning id into v_pipeline;

  insert into public.deal_stages (workspace_id, pipeline_id, name, position, color) values
    (v_workspace, v_pipeline, 'Lead', 1, '#94a3b8'),
    (v_workspace, v_pipeline, 'Qualified', 2, '#60a5fa'),
    (v_workspace, v_pipeline, 'Proposal', 3, '#f59e0b'),
    (v_workspace, v_pipeline, 'Negotiation', 4, '#a855f7'),
    (v_workspace, v_pipeline, 'Won', 5, '#22c55e'),
    (v_workspace, v_pipeline, 'Lost', 6, '#ef4444');

  return v_workspace;
end;
$$;
