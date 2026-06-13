-- 0012_leads_enhancements.sql
-- Brings the leads feature to parity with deals/contacts:
--   * lead ownership + updated_at tracking
--   * campaign scheduling hour + minimum-score threshold
--   * lead-level Notes / Files / Activity (mirrors the deal pattern)
--
-- Mirrors the column-add + index pattern from 0009_file_folders.sql / 0011.

-- ---------------------------------------------------------------------------
-- leads: ownership + edit tracking
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists owner_user_id uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();
create index if not exists leads_owner_idx
  on public.leads(workspace_id, owner_user_id);

-- ---------------------------------------------------------------------------
-- lead_campaigns: scheduling hour (UTC) + minimum score to keep a lead
-- ---------------------------------------------------------------------------
alter table public.lead_campaigns
  add column if not exists run_hour int not null default 9,
  add column if not exists min_score int not null default 0;

-- ---------------------------------------------------------------------------
-- Lead-level Notes / Files / Activity (so the detail page has the same tabs
-- as deals). RLS on these tables is workspace/permission based, so the new
-- foreign keys need no policy changes.
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists lead_id uuid references public.leads(id) on delete cascade;
create index if not exists notes_lead_idx on public.notes(lead_id);

alter table public.activities
  add column if not exists lead_id uuid references public.leads(id) on delete cascade;
create index if not exists activities_lead_idx on public.activities(lead_id);

-- Extend the attachments entity_type check to allow 'lead' (same move 0009
-- used to add 'workspace').
alter table public.attachments
  drop constraint attachments_entity_type_check;
alter table public.attachments
  add constraint attachments_entity_type_check
  check (entity_type in ('company','contact','deal','note','workspace','lead'));
