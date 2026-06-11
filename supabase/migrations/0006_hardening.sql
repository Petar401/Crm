-- 0006_hardening.sql
-- Security hardening surfaced by the Supabase linter.
--
-- 1. Pin search_path on the updated_at trigger helper.
-- 2. Stop the signup trigger function from being directly RPC-callable, and
--    keep the workspace-bootstrap RPC available to authenticated users only.
--
-- Note: is_workspace_member / has_permission / shares_workspace_with remain
-- executable by `authenticated` because RLS policies evaluate them in the
-- caller's role context; they only return booleans scoped to the caller.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.create_workspace_for_user(text) from anon;
