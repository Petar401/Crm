-- 0031_notifications_recipient_check.sql
-- Tightens the notifications insert policy from 0027.
--
-- The original policy only checked that the *sender* belongs to the
-- notification's workspace, so any member could insert a notification
-- addressed to any user id in the whole instance, including users of other
-- workspaces. A recipient must now also be a member of that same workspace.
--
-- Additive and idempotent: safe to re-run. No data changes.

drop policy if exists "notifications_insert_member" on public.notifications;

create policy "notifications_insert_member" on public.notifications
  for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.workspace_members m
      where m.workspace_id = notifications.workspace_id
        and m.user_id = notifications.user_id
    )
  );
