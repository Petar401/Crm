-- 0033_calendar_events.sql
-- Real calendar events with start/end/timezone. Coexists with activities:
-- an insert trigger writes a companion activity row (type='meeting') so the
-- existing timelines populate without duplicating storage.
--
-- Note: numbered 0033 (not 0032) so Stripe (phase D) can slot in as 0032
-- when it lands.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid references public.profiles(id),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  source text not null default 'internal'
    check (source in ('internal', 'google', 'microsoft')),
  external_id text,
  external_etag text,
  external_calendar_id text,
  rrule text,
  deal_id uuid references public.deals(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index calendar_events_workspace_idx
  on public.calendar_events(workspace_id);
create index calendar_events_range_idx
  on public.calendar_events(workspace_id, start_at);
create index calendar_events_owner_idx
  on public.calendar_events(owner_user_id);
create unique index calendar_events_external_key
  on public.calendar_events(source, external_id)
  where external_id is not null;

create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Attendees
-- ---------------------------------------------------------------------------
create table public.calendar_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.calendar_events(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  name text,
  response text not null default 'needs_action'
    check (response in ('needs_action', 'accepted', 'declined', 'tentative')),
  created_at timestamptz not null default now()
);
create index calendar_event_attendees_event_idx
  on public.calendar_event_attendees(event_id);

-- ---------------------------------------------------------------------------
-- Bridge: mirror to `activities` timeline
-- ---------------------------------------------------------------------------
create or replace function public.calendar_event_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activities (
    workspace_id, type, title, detail,
    company_id, contact_id, deal_id, lead_id, actor_user_id
  ) values (
    new.workspace_id, 'meeting', new.title, new.description,
    new.company_id, new.contact_id, new.deal_id, new.lead_id, new.created_by
  );
  return new;
end;
$$;

create trigger calendar_events_activity_bridge
  after insert on public.calendar_events
  for each row execute function public.calendar_event_to_activity();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;

create policy "calendar_events_select" on public.calendar_events
  for select using (public.has_permission(workspace_id, 'calendar.view'));
create policy "calendar_events_insert" on public.calendar_events
  for insert with check (public.has_permission(workspace_id, 'calendar.create'));
create policy "calendar_events_update" on public.calendar_events
  for update using (public.has_permission(workspace_id, 'calendar.update'))
  with check (public.has_permission(workspace_id, 'calendar.update'));
create policy "calendar_events_delete" on public.calendar_events
  for delete using (public.has_permission(workspace_id, 'calendar.delete'));

create policy "calendar_event_attendees_select" on public.calendar_event_attendees
  for select using (
    exists (
      select 1 from public.calendar_events e
      where e.id = calendar_event_attendees.event_id
        and public.has_permission(e.workspace_id, 'calendar.view')
    )
  );
create policy "calendar_event_attendees_write" on public.calendar_event_attendees
  for all using (
    exists (
      select 1 from public.calendar_events e
      where e.id = calendar_event_attendees.event_id
        and public.has_permission(e.workspace_id, 'calendar.update')
    )
  ) with check (
    exists (
      select 1 from public.calendar_events e
      where e.id = calendar_event_attendees.event_id
        and public.has_permission(e.workspace_id, 'calendar.update')
    )
  );
