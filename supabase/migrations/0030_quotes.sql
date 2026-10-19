-- 0030_quotes.sql
-- Quotes: line items on a deal, priced against the products catalog.
-- Includes a public share/sign flow via revocable, hashed tokens.
--
-- Money on line rows uses bigint minor units (pence, cents, öre) to avoid
-- accumulated rounding. Headers denormalise the computed subtotal / tax /
-- discount / total the same way for cheap listing queries.

-- ---------------------------------------------------------------------------
-- Per-workspace numbering source (Q-1000, Q-1001, …).
-- ---------------------------------------------------------------------------
create table public.quote_numbering (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  prefix text not null default 'Q-',
  next integer not null default 1000,
  updated_at timestamptz not null default now()
);

-- Allocates and returns the next quote number, initialising the row if this
-- is the workspace's first quote. security definer so the RLS-blocked write
-- to the numbering row cannot corrupt the sequence.
create or replace function public.next_quote_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  insert into public.quote_numbering (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;

  update public.quote_numbering
    set next = next + 1,
        updated_at = now()
    where workspace_id = p_workspace_id
  returning prefix, next - 1
  into v_prefix, v_next;

  return v_prefix || v_next::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number text not null,
  deal_id uuid references public.deals(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'expired', 'void')),
  currency text not null default 'GBP',
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  total_minor bigint not null default 0,
  valid_until date,
  notes text,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  signed_by_email text,
  signed_ip text,
  signature_svg text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quotes_workspace_number_key
  on public.quotes(workspace_id, number);
create index quotes_workspace_idx on public.quotes(workspace_id);
create index quotes_deal_idx on public.quotes(deal_id);
create index quotes_status_idx on public.quotes(status);

create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quote lines
-- ---------------------------------------------------------------------------
create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position integer not null default 0,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price_minor bigint not null default 0,
  discount_bps integer not null default 0
    check (discount_bps >= 0 and discount_bps <= 10000),
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  tax_rate_bps integer not null default 0,
  line_subtotal_minor bigint not null default 0,
  line_tax_minor bigint not null default 0,
  line_total_minor bigint not null default 0,
  created_at timestamptz not null default now()
);
create index quote_lines_quote_idx on public.quote_lines(quote_id);
create index quote_lines_position_idx on public.quote_lines(quote_id, position);

-- ---------------------------------------------------------------------------
-- Share tokens: revocable, sha256-hashed at rest.
-- ---------------------------------------------------------------------------
create table public.quote_share_tokens (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index quote_share_tokens_quote_idx
  on public.quote_share_tokens(quote_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.quote_numbering enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_share_tokens enable row level security;

-- Numbering rows are internal — no direct policies needed beyond deny, since
-- next_quote_number() runs security definer.

create policy "quotes_select" on public.quotes
  for select using (public.has_permission(workspace_id, 'quotes.view'));
create policy "quotes_insert" on public.quotes
  for insert with check (public.has_permission(workspace_id, 'quotes.create'));
create policy "quotes_update" on public.quotes
  for update using (public.has_permission(workspace_id, 'quotes.update'))
  with check (public.has_permission(workspace_id, 'quotes.update'));
create policy "quotes_delete" on public.quotes
  for delete using (public.has_permission(workspace_id, 'quotes.delete'));

create policy "quote_lines_select" on public.quote_lines
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and public.has_permission(q.workspace_id, 'quotes.view')
    )
  );
create policy "quote_lines_write" on public.quote_lines
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and public.has_permission(q.workspace_id, 'quotes.update')
    )
  ) with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and public.has_permission(q.workspace_id, 'quotes.update')
    )
  );

create policy "quote_share_tokens_select" on public.quote_share_tokens
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_share_tokens.quote_id
        and public.has_permission(q.workspace_id, 'quotes.view')
    )
  );
create policy "quote_share_tokens_write" on public.quote_share_tokens
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_share_tokens.quote_id
        and public.has_permission(q.workspace_id, 'quotes.send')
    )
  ) with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_share_tokens.quote_id
        and public.has_permission(q.workspace_id, 'quotes.send')
    )
  );
