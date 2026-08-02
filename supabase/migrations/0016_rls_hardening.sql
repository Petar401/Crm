-- 0016_rls_hardening.sql
-- Follow-up hardening surfaced by the security audit.
--
-- A6. activities INSERT lets any workspace member forge timeline entries with
--     an arbitrary actor_user_id (`activities_insert` previously only checked
--     is_workspace_member). We keep the member gate but additionally require
--     `actor_user_id = auth.uid()`, so a member can only ever insert rows
--     attributed to themselves. That closes the impersonation vector while
--     keeping the app's server-action logActivity flow working (it already
--     sets actor_user_id = ctx.userId).
--
-- A8. create_workspace_for_user was executable by any authenticated user (only
--     `anon` had been revoked). This lets any signed-in user churn workspace
--     rows (metadata DoS) and, on a multi-tenant redeploy, bootstrap
--     unrelated tenants. Only the shared join RPC needs the function now, and
--     it invokes it as SECURITY DEFINER, so we revoke direct execute.

drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert with check (
    public.is_workspace_member(workspace_id)
    and actor_user_id = auth.uid()
  );

revoke execute on function public.create_workspace_for_user(text) from authenticated;
