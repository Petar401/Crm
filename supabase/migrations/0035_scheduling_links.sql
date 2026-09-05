-- 0035_scheduling_links.sql
-- Calendly-style public booking links owned by a workspace user, plus the
-- bookings they create. Numbered 0035 so 0034 stays free for
-- calendar_accounts (Google/Microsoft two-way sync) in phase F.

create table public.scheduling_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 480),
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  timezone text not null default 'Europe/London',
  availability jsonb not null default jsonb_build_object(
    'mon', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00')),
    'tue', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00')),
    'wed', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00')),
    'thu', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00')),
    'fri', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00')),
    'sat', jsonb_build_array(),
    'sun', jsonb_build_array()
  ),
  min_notice_minutes integer not null default 120,
  max_days_ahead integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index scheduling_links_slug_key
  on public.scheduling_links(slug);
create index scheduling_links_workspace_idx
  on public.scheduling_links(workspace_id);
create index scheduling_links_owner_idx
  on public.scheduling_links(owner_user_id);

create trigger scheduling_links_updated_at before update on public.scheduling_links
  for each row execute function public.set_updated_at();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  scheduling_link_id uuid not null
    references public.scheduling_links(id) on delete cascade,
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  invitee_name text not null,
  invitee_email text not null,
  invitee_notes text,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index bookings_link_idx on public.bookings(scheduling_link_id);
create index bookings_event_idx on public.bookings(calendar_event_id);

-- RLS
alter table public.scheduling_links enable row level security;
alter table public.bookings enable row level security;

-- Read: any workspace member with scheduling.view; write: scheduling.manage
-- restricted to the owner or someone with team.edit_roles (so an admin can
-- disable a link).
create policy "scheduling_links_select" on public.scheduling_links
  for select using (public.has_permission(workspace_id, 'scheduling.view'));
create policy "scheduling_links_insert" on public.scheduling_links
  for insert with check (
    public.has_permission(workspace_id, 'scheduling.manage')
    and owner_user_id = auth.uid()
  );
create policy "scheduling_links_update" on public.scheduling_links
  for update using (
    public.has_permission(workspace_id, 'scheduling.manage')
    and (owner_user_id = auth.uid()
         or public.has_permission(workspace_id, 'team.edit_roles'))
  ) with check (
    public.has_permission(workspace_id, 'scheduling.manage')
  );
create policy "scheduling_links_delete" on public.scheduling_links
  for delete using (
    public.has_permission(workspace_id, 'scheduling.manage')
    and (owner_user_id = auth.uid()
         or public.has_permission(workspace_id, 'team.edit_roles'))
  );

create policy "bookings_select" on public.bookings
  for select using (
    exists (
      select 1 from public.scheduling_links l
      where l.id = bookings.scheduling_link_id
        and public.has_permission(l.workspace_id, 'scheduling.view')
    )
  );
-- Writes happen from the public route via the admin client — RLS blocks the
-- session path so no policy is granted here.
