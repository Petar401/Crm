-- 0023_apollo_campaigns.sql
-- Adds Apollo.io as a lead-campaign source alongside the existing free
-- OpenStreetMap one. A campaign's `source` decides which engine
-- src/features/leads/generate.ts:runCampaign dispatches to. No other
-- lead_campaigns columns change: target_categories/location/country/
-- frequency/run_hour/min_score/max_results are all reused as-is (for Apollo,
-- target_categories holds job titles instead of business categories).
-- `auto_create` is ignored for Apollo campaigns — their results always land
-- in the pending review queue (enforced in src/features/leads/actions.ts).

alter table public.lead_campaigns
  add column source text not null default 'openstreetmap'
    check (source in ('openstreetmap', 'apollo'));
