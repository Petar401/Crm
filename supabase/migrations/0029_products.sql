-- 0029_products.sql
-- Products catalog + price books + tax rates. Building blocks for the CPQ /
-- billing engine (quotes and billing_invoices land in later migrations).
--
-- All tables are workspace-scoped with RLS via has_permission(). Money on
-- catalog rows is stored as numeric(14,2) for display; quote and invoice
-- line rows in later migrations use bigint minor units to avoid rounding.

-- ---------------------------------------------------------------------------
-- Tax rates
-- ---------------------------------------------------------------------------
create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  -- Basis points. 2000 = 20%. Integer avoids float rounding surprises.
  rate_bps integer not null check (rate_bps >= 0 and rate_bps <= 100000),
  region text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tax_rates_workspace_idx on public.tax_rates(workspace_id);
create unique index tax_rates_default_per_workspace
  on public.tax_rates(workspace_id) where is_default;

create trigger tax_rates_updated_at before update on public.tax_rates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku text,
  name text not null,
  description text,
  kind text not null default 'one_time'
    check (kind in ('one_time', 'recurring')),
  recurring_interval text
    check (recurring_interval in ('day', 'week', 'month', 'year')),
  unit text not null default 'unit',
  default_currency text not null default 'GBP',
  default_price numeric(14, 2) not null default 0,
  default_tax_rate_id uuid references public.tax_rates(id) on delete set null,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_workspace_idx on public.products(workspace_id);
create unique index products_workspace_sku_key
  on public.products(workspace_id, sku) where sku is not null;

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Price books
-- ---------------------------------------------------------------------------
create table public.price_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  currency text not null default 'GBP',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index price_books_workspace_idx on public.price_books(workspace_id);
create unique index price_books_default_per_workspace
  on public.price_books(workspace_id) where is_default;

create trigger price_books_updated_at before update on public.price_books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Price book entries: per-book override of a product's unit price.
-- ---------------------------------------------------------------------------
create table public.price_book_entries (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid not null references public.price_books(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_price numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
create unique index price_book_entries_book_product_key
  on public.price_book_entries(price_book_id, product_id);
create index price_book_entries_product_idx
  on public.price_book_entries(product_id);

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.tax_rates enable row level security;
alter table public.products enable row level security;
alter table public.price_books enable row level security;
alter table public.price_book_entries enable row level security;

-- Tax rates reuse the products.* permission group (kept off the UI matrix
-- as a separate group to keep it short).
create policy "tax_rates_select" on public.tax_rates
  for select using (public.has_permission(workspace_id, 'products.view'));
create policy "tax_rates_insert" on public.tax_rates
  for insert with check (public.has_permission(workspace_id, 'products.create'));
create policy "tax_rates_update" on public.tax_rates
  for update using (public.has_permission(workspace_id, 'products.update'))
  with check (public.has_permission(workspace_id, 'products.update'));
create policy "tax_rates_delete" on public.tax_rates
  for delete using (public.has_permission(workspace_id, 'products.delete'));

create policy "products_select" on public.products
  for select using (public.has_permission(workspace_id, 'products.view'));
create policy "products_insert" on public.products
  for insert with check (public.has_permission(workspace_id, 'products.create'));
create policy "products_update" on public.products
  for update using (public.has_permission(workspace_id, 'products.update'))
  with check (public.has_permission(workspace_id, 'products.update'));
create policy "products_delete" on public.products
  for delete using (public.has_permission(workspace_id, 'products.delete'));

create policy "price_books_select" on public.price_books
  for select using (public.has_permission(workspace_id, 'products.view'));
create policy "price_books_insert" on public.price_books
  for insert with check (public.has_permission(workspace_id, 'products.create'));
create policy "price_books_update" on public.price_books
  for update using (public.has_permission(workspace_id, 'products.update'))
  with check (public.has_permission(workspace_id, 'products.update'));
create policy "price_books_delete" on public.price_books
  for delete using (public.has_permission(workspace_id, 'products.delete'));

-- price_book_entries piggyback on the parent price_book's workspace.
create policy "pbe_select" on public.price_book_entries
  for select using (
    exists (
      select 1 from public.price_books pb
      where pb.id = price_book_entries.price_book_id
        and public.has_permission(pb.workspace_id, 'products.view')
    )
  );
create policy "pbe_insert" on public.price_book_entries
  for insert with check (
    exists (
      select 1 from public.price_books pb
      where pb.id = price_book_entries.price_book_id
        and public.has_permission(pb.workspace_id, 'products.create')
    )
  );
create policy "pbe_update" on public.price_book_entries
  for update using (
    exists (
      select 1 from public.price_books pb
      where pb.id = price_book_entries.price_book_id
        and public.has_permission(pb.workspace_id, 'products.update')
    )
  ) with check (
    exists (
      select 1 from public.price_books pb
      where pb.id = price_book_entries.price_book_id
        and public.has_permission(pb.workspace_id, 'products.update')
    )
  );
create policy "pbe_delete" on public.price_book_entries
  for delete using (
    exists (
      select 1 from public.price_books pb
      where pb.id = price_book_entries.price_book_id
        and public.has_permission(pb.workspace_id, 'products.delete')
    )
  );
