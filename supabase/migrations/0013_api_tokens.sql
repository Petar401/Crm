-- 0013_api_tokens.sql
-- Personal access tokens used by external clients (e.g. Claude Desktop's MCP
-- connector) to authenticate as a specific workspace member. Only a SHA-256
-- hash of the plaintext token is stored; the plaintext is shown to the user
-- exactly once at creation time.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_tokens_member_idx on public.api_tokens(workspace_member_id);
create index api_tokens_workspace_idx on public.api_tokens(workspace_id);

alter table public.api_tokens enable row level security;

-- A user can see, mint, and revoke tokens for their own workspace membership.
-- The MCP route uses the service-role client to look tokens up by hash, so no
-- policy needs to cover that path.
create policy "api_tokens_select_own" on public.api_tokens
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.id = api_tokens.workspace_member_id
        and m.user_id = auth.uid()
    )
  );

create policy "api_tokens_insert_own" on public.api_tokens
  for insert with check (
    exists (
      select 1 from public.workspace_members m
      where m.id = api_tokens.workspace_member_id
        and m.user_id = auth.uid()
    )
  );

create policy "api_tokens_delete_own" on public.api_tokens
  for delete using (
    exists (
      select 1 from public.workspace_members m
      where m.id = api_tokens.workspace_member_id
        and m.user_id = auth.uid()
    )
  );

-- Register the new permission key in the catalog so it can appear in the
-- role/override editor. Owners and full-access members get it by default via
-- the app-side resolver (is_full_access / isOwner).
insert into public.permissions (key, description)
values ('settings.tokens', 'Create and revoke personal API tokens')
on conflict (key) do nothing;
