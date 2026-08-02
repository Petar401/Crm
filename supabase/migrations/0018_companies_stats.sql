-- 0018_companies_stats.sql
-- Collapse the companies list N+1 (audit B3).
--
-- Before: `getCompanies` selected `*, contacts(count), deals(value, status)`
-- which asked PostgREST to embed every deal per company and every contact
-- count per company, then aggregated in JS on the server. At scale this
-- pulled the entire deals table for the workspace on every companies list
-- render — an O(deals × companies) shape hidden inside one query.
--
-- After: a pre-aggregated view keyed on (id, workspace_id) that PostgREST
-- can select in one round-trip without the embedded-relation blow-up. The
-- view is a SECURITY INVOKER read, so RLS on the underlying tables still
-- gates access — no workspace can see another's counts.

create or replace view public.companies_with_stats
with (security_invoker = true) as
select
  c.*,
  coalesce(ct.contact_count, 0) as contact_count,
  coalesce(dl.open_deals_value, 0) as open_deals_value
from public.companies c
left join lateral (
  select count(*)::int as contact_count
  from public.contacts x
  where x.company_id = c.id
) ct on true
left join lateral (
  select coalesce(sum(x.value), 0)::numeric as open_deals_value
  from public.deals x
  where x.company_id = c.id and x.status = 'open'
) dl on true;

grant select on public.companies_with_stats to authenticated;
