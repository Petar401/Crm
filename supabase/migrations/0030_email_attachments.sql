-- 0030_email_attachments.sql
-- Lets an outgoing email carry attachments pulled from the workspace's Files
-- or Invoices. `attachments` is a snapshot taken at send time
-- ([{file_name, storage_bucket, storage_path}]), not a live FK, so the Sent
-- log keeps showing what was attached even if the source file is later
-- deleted or moved.

alter table public.emails
  add column attachments jsonb not null default '[]'::jsonb;
