-- 0014_mcp_oauth.sql
-- OAuth 2.1 authorization server for the MCP connector. Lets OAuth clients
-- (e.g. Claude Desktop's custom connector, which uses Dynamic Client
-- Registration + PKCE) obtain an access token that authenticates as a specific
-- workspace member, instead of the user pasting a personal access token.
--
-- Only hashes of authorization codes, access tokens, refresh tokens, and client
-- secrets are stored. All three tables are written and read exclusively by the
-- service-role client in `src/features/oauth/store.ts`, so RLS is enabled with
-- no broad policies (deny-all to end users); the service role bypasses RLS.

-- Registered OAuth clients (created via Dynamic Client Registration, RFC 7591).
create table public.oauth_clients (
  client_id text primary key,
  client_secret_hash text,
  client_name text,
  redirect_uris text[] not null,
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  response_types text[] not null default array['code'],
  token_endpoint_auth_method text not null default 'none',
  scope text,
  created_at timestamptz not null default now()
);

-- Short-lived, single-use authorization codes (RFC 6749 + PKCE, RFC 7636).
create table public.oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scope text,
  resource text,
  consumed boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index oauth_authorization_codes_client_idx
  on public.oauth_authorization_codes(client_id);

-- Issued access/refresh tokens. Access tokens are verified on every MCP request.
create table public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  refresh_token_hash text unique,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text,
  resource text,
  client_name text,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_access_tokens_member_idx
  on public.oauth_access_tokens(workspace_member_id);
create index oauth_access_tokens_refresh_idx
  on public.oauth_access_tokens(refresh_token_hash);

alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_access_tokens enable row level security;

-- oauth_clients and oauth_authorization_codes have NO policies: they are touched
-- only by the service-role client, which bypasses RLS. End users get no access.

-- A member may view and revoke their own connected apps (access tokens) so the
-- Settings → Connectors UI can list and disconnect them. Inserts/updates still
-- go through the service role only.
create policy "oauth_access_tokens_select_own" on public.oauth_access_tokens
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.id = oauth_access_tokens.workspace_member_id
        and m.user_id = auth.uid()
    )
  );

create policy "oauth_access_tokens_delete_own" on public.oauth_access_tokens
  for delete using (
    exists (
      select 1 from public.workspace_members m
      where m.id = oauth_access_tokens.workspace_member_id
        and m.user_id = auth.uid()
    )
  );
