-- 0026_multi_tenant.sql
-- Turn the CRM into a real multi-tenant SaaS: every signup now gets its own
-- workspace instead of joining the single shared one. Adds workspace profile
-- columns, an invitations table, and an onboarding-progress table.

-- ---------------------------------------------------------------------------
-- A. Workspace profile columns
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column if not exists industry text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists currency text not null default 'USD',
  add column if not exists locale text not null default 'en-US',
  add column if not exists logo_url text;

-- ---------------------------------------------------------------------------
-- B. create_workspace_for_current_user — the new signup / "add workspace" RPC.
--    Extends the original create_workspace_for_user() with the profile fields.
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace_for_current_user(
  workspace_name text,
  industry text default null,
  timezone text default 'UTC',
  currency text default 'USD',
  locale text default 'en-US'
)
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

  v_slug := regexp_replace(lower(coalesce(nullif(trim(workspace_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'workspace'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.workspaces (name, slug, created_by, industry, timezone, currency, locale)
  values (
    coalesce(nullif(trim(workspace_name), ''), 'My Workspace'),
    v_slug,
    v_user,
    nullif(trim(coalesce(industry, '')), ''),
    coalesce(nullif(trim(timezone), ''), 'UTC'),
    coalesce(nullif(trim(currency), ''), 'USD'),
    coalesce(nullif(trim(locale), ''), 'en-US')
  )
  returning id into v_workspace;

  -- Seed the named role catalog (Owner / Admin / Manager / Sales Rep / Read-only).
  -- Owner is marked default so future joiners inherit its permissions when no
  -- role is picked explicitly. The workspace creator gets is_full_access = true
  -- so they can never lock themselves out.
  insert into public.roles (workspace_id, name, is_default) values
    (v_workspace, 'Owner',     true),
    (v_workspace, 'Admin',     false),
    (v_workspace, 'Manager',   false),
    (v_workspace, 'Sales Rep', false),
    (v_workspace, 'Read-only', false);

  select id into v_role
  from public.roles
  where workspace_id = v_workspace and name = 'Owner'
  limit 1;

  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  values (v_workspace, v_user, 'owner', v_role, true);

  -- Default pipeline + stages.
  insert into public.deal_pipelines (workspace_id, name, is_default)
  values (v_workspace, 'Sales Pipeline', true)
  returning id into v_pipeline;

  insert into public.deal_stages (workspace_id, pipeline_id, name, position, color) values
    (v_workspace, v_pipeline, 'Lead',        1, '#94a3b8'),
    (v_workspace, v_pipeline, 'Qualified',   2, '#60a5fa'),
    (v_workspace, v_pipeline, 'Proposal',    3, '#f59e0b'),
    (v_workspace, v_pipeline, 'Negotiation', 4, '#a855f7'),
    (v_workspace, v_pipeline, 'Won',         5, '#22c55e'),
    (v_workspace, v_pipeline, 'Lost',        6, '#ef4444');

  return v_workspace;
end;
$$;

grant execute on function public.create_workspace_for_current_user(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- C. workspace_invitations — email-based invites with a shareable token.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role_id uuid references public.roles(id) on delete set null,
  token text unique not null,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
create index if not exists workspace_invitations_email_idx on public.workspace_invitations(lower(email));
create index if not exists workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id);

alter table public.workspace_invitations enable row level security;

-- Members who can invite can read/manage invitations; the invitee can also read
-- their own row (matched by email) so /invite/[token] can display it.
create policy "invitations_select_admin" on public.workspace_invitations
  for select using (public.has_permission(workspace_id, 'team.invite'));
create policy "invitations_select_invitee" on public.workspace_invitations
  for select using (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
create policy "invitations_insert" on public.workspace_invitations
  for insert with check (public.has_permission(workspace_id, 'team.invite'));
create policy "invitations_update_admin" on public.workspace_invitations
  for update using (public.has_permission(workspace_id, 'team.invite'))
  with check (public.has_permission(workspace_id, 'team.invite'));
create policy "invitations_delete" on public.workspace_invitations
  for delete using (public.has_permission(workspace_id, 'team.invite'));

-- ---------------------------------------------------------------------------
-- D. accept_workspace_invitation — token-driven join. Runs SECURITY DEFINER so
--    the caller can be added to a workspace they are not yet a member of.
-- ---------------------------------------------------------------------------
create or replace function public.accept_workspace_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.workspace_invitations%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user;

  select * into v_inv
  from public.workspace_invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Invitation already used';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  if lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Invitation email does not match your account';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, role_id, is_full_access)
  values (v_inv.workspace_id, v_user, 'member', v_inv.role_id, false)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- E. workspace_onboarding — resumable wizard progress.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_onboarding (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  completed_steps int[] not null default '{}',
  template_key text,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.workspace_onboarding enable row level security;

create policy "onboarding_select" on public.workspace_onboarding
  for select using (public.is_workspace_member(workspace_id));
create policy "onboarding_write" on public.workspace_onboarding
  for all using (public.has_permission(workspace_id, 'settings.update'))
  with check (public.has_permission(workspace_id, 'settings.update'));

-- ---------------------------------------------------------------------------
-- F. Allow the workspace owner (created_by) or team.edit_roles-holders to
--    update the workspace row's profile columns. Existing policy already
--    covers owner + settings.update, so no change is needed here.
-- ---------------------------------------------------------------------------
