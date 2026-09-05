-- 0031_billing_invoices.sql
-- Real billing invoices — separate from the receipt cabinet in 0019_invoices.sql.
-- Generated from a signed quote or a won deal, and carry a proper per-workspace
-- number sequence. Money in minor units (bigint) to avoid rounding.

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
create table public.billing_invoice_numbering (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  prefix text not null default 'INV-',
  next integer not null default 1000,
  updated_at timestamptz not null default now()
);

create or replace function public.next_billing_invoice_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  insert into public.billing_invoice_numbering (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;

  update public.billing_invoice_numbering
    set next = next + 1,
        updated_at = now()
    where workspace_id = p_workspace_id
  returning prefix, next - 1
  into v_prefix, v_next;

  return v_prefix || v_next::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Billing invoices
-- ---------------------------------------------------------------------------
create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number text not null,
  deal_id uuid references public.deals(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'uncollectible', 'void')),
  currency text not null default 'GBP',
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  total_minor bigint not null default 0,
  amount_paid_minor bigint not null default 0,
  issued_at timestamptz,
  due_date date,
  paid_at timestamptz,
  memo text,
  external_ref text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index billing_invoices_workspace_number_key
  on public.billing_invoices(workspace_id, number);
create index billing_invoices_workspace_idx
  on public.billing_invoices(workspace_id);
create index billing_invoices_status_idx
  on public.billing_invoices(status);
create index billing_invoices_due_date_idx
  on public.billing_invoices(due_date) where status in ('open');

create trigger billing_invoices_updated_at before update on public.billing_invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Billing invoice lines
-- ---------------------------------------------------------------------------
create table public.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  billing_invoice_id uuid not null
    references public.billing_invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position integer not null default 0,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price_minor bigint not null default 0,
  discount_bps integer not null default 0,
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  tax_rate_bps integer not null default 0,
  line_subtotal_minor bigint not null default 0,
  line_tax_minor bigint not null default 0,
  line_total_minor bigint not null default 0,
  created_at timestamptz not null default now()
);
create index billing_invoice_lines_parent_idx
  on public.billing_invoice_lines(billing_invoice_id);

-- ---------------------------------------------------------------------------
-- Payments ledger
-- ---------------------------------------------------------------------------
create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  billing_invoice_id uuid not null
    references public.billing_invoices(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount_minor bigint not null,
  currency text not null,
  method text,
  external_ref text,
  paid_at timestamptz not null default now(),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index billing_payments_invoice_idx
  on public.billing_payments(billing_invoice_id);
create index billing_payments_workspace_idx
  on public.billing_payments(workspace_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_invoice_numbering enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_lines enable row level security;
alter table public.billing_payments enable row level security;

create policy "billing_invoices_select" on public.billing_invoices
  for select using (public.has_permission(workspace_id, 'billing.view'));
create policy "billing_invoices_insert" on public.billing_invoices
  for insert with check (public.has_permission(workspace_id, 'billing.create'));
create policy "billing_invoices_update" on public.billing_invoices
  for update using (public.has_permission(workspace_id, 'billing.update'))
  with check (public.has_permission(workspace_id, 'billing.update'));
create policy "billing_invoices_delete" on public.billing_invoices
  for delete using (public.has_permission(workspace_id, 'billing.delete'));

create policy "billing_invoice_lines_select" on public.billing_invoice_lines
  for select using (
    exists (
      select 1 from public.billing_invoices i
      where i.id = billing_invoice_lines.billing_invoice_id
        and public.has_permission(i.workspace_id, 'billing.view')
    )
  );
create policy "billing_invoice_lines_write" on public.billing_invoice_lines
  for all using (
    exists (
      select 1 from public.billing_invoices i
      where i.id = billing_invoice_lines.billing_invoice_id
        and public.has_permission(i.workspace_id, 'billing.update')
    )
  ) with check (
    exists (
      select 1 from public.billing_invoices i
      where i.id = billing_invoice_lines.billing_invoice_id
        and public.has_permission(i.workspace_id, 'billing.update')
    )
  );

create policy "billing_payments_select" on public.billing_payments
  for select using (public.has_permission(workspace_id, 'billing.view'));
create policy "billing_payments_write" on public.billing_payments
  for all using (public.has_permission(workspace_id, 'billing.update'))
  with check (public.has_permission(workspace_id, 'billing.update'));
