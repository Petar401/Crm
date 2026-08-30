-- 0024_leads_address_fields.sql
-- Adds state/postal_code to leads so Apollo's Organization Enrichment
-- (src/features/apollo/client.ts: enrichOrganization, previously unused) has
-- somewhere to land richer company-address data on import. No RLS changes
-- needed: leads_select/insert/update/delete in 0011_lead_automation.sql are
-- workspace/permission-scoped, not column-scoped.
--
-- Note: named `postal_code` here, not `postcode` like companies.postcode
-- (0002_crm_core.sql) — intentionally inconsistent, not a bug to "fix" later.

alter table public.leads
  add column if not exists state text,
  add column if not exists postal_code text;
