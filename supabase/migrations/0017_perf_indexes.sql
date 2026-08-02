-- 0017_perf_indexes.sql
-- Composite indexes for the hot WHERE + ORDER pairs the audit flagged. The
-- existing migrations only indexed `workspace_id` on each entity, so every
-- filtered list query and every dashboard tile did a workspace-scoped scan
-- and sorted in memory. These indexes cover the common cases so PostgREST
-- can serve them index-only.
--
-- All indexes are created with IF NOT EXISTS so re-running the migration on
-- an environment that has been tuned by hand does not fail. Left un-CONCURRENT
-- because supabase-cli runs migrations in a transaction; enable CONCURRENTLY
-- manually if backfilling on a busy production dataset.

-- Deals: open/won/lost split (dashboard tile "openDeals", win-rate, list).
create index if not exists deals_workspace_status_idx
  on public.deals (workspace_id, status);

-- Tasks: due-today / overdue tiles + upcoming-tasks list.
create index if not exists tasks_workspace_status_due_idx
  on public.tasks (workspace_id, status, due_at);

-- Activities: recent-timeline + per-entity timeline queries.
create index if not exists activities_workspace_created_idx
  on public.activities (workspace_id, created_at desc);

-- Companies: dashboard "new leads this/last week" filter + list ordering.
create index if not exists companies_workspace_status_created_idx
  on public.companies (workspace_id, status, created_at desc);

-- Leads: default list orders by match_score desc within a status; the audit
-- found the leads.match_score column wasn't indexed at all.
create index if not exists leads_workspace_status_score_idx
  on public.leads (workspace_id, status, match_score desc);

-- Notebook: sidebar order (updated_at desc within workspace).
create index if not exists notebook_notes_workspace_updated_idx
  on public.notebook_notes (workspace_id, updated_at desc);
