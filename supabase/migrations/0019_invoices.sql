-- 0019_invoices.sql
-- Adds a dedicated Invoices section: nestable invoice folders (group by tax
-- year / type) plus invoice/receipt files carrying structured metadata
-- (type, vendor, amount, date). Fully separate from the workspace file manager
-- (folders/attachments) — existing tables and behavior are left unchanged.

-- ---------------------------------------------------------------------------
-- Nestable invoice folders (mirrors public.folders).
-- ---------------------------------------------------------------------------
create table public.invoice_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.invoice_folders(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoice_folders_workspace_idx on public.invoice_folders(workspace_id);
create index invoice_folders_parent_idx on public.invoice_folders(parent_id);

create trigger invoice_folders_updated_at before update on public.invoice_folders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices: an uploaded invoice/receipt file plus structured metadata.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.invoice_folders(id) on delete set null,
  doc_type text not null default 'invoice'
    check (doc_type in ('invoice', 'receipt', 'other')),
  vendor text,
  amount numeric(14, 2),
  currency text,
  invoice_date date,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_workspace_idx on public.invoices(workspace_id);
create index invoices_folder_idx on public.invoices(folder_id);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: both tables follow the invoices.* permission model.
-- ---------------------------------------------------------------------------
alter table public.invoice_folders enable row level security;

create policy "invoice_folders_select" on public.invoice_folders
  for select using (public.has_permission(workspace_id, 'invoices.view'));
create policy "invoice_folders_insert" on public.invoice_folders
  for insert with check (public.has_permission(workspace_id, 'invoices.upload'));
create policy "invoice_folders_update" on public.invoice_folders
  for update using (public.has_permission(workspace_id, 'invoices.upload'))
  with check (public.has_permission(workspace_id, 'invoices.upload'));
create policy "invoice_folders_delete" on public.invoice_folders
  for delete using (public.has_permission(workspace_id, 'invoices.delete'));

alter table public.invoices enable row level security;

create policy "invoices_select" on public.invoices
  for select using (public.has_permission(workspace_id, 'invoices.view'));
create policy "invoices_insert" on public.invoices
  for insert with check (public.has_permission(workspace_id, 'invoices.upload'));
create policy "invoices_update" on public.invoices
  for update using (public.has_permission(workspace_id, 'invoices.upload'))
  with check (public.has_permission(workspace_id, 'invoices.upload'));
create policy "invoices_delete" on public.invoices
  for delete using (public.has_permission(workspace_id, 'invoices.delete'));

-- ---------------------------------------------------------------------------
-- Storage: private "invoices" bucket. Object path is
-- <workspace_id>/invoices/<uuid>-<filename>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices_storage_select" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'invoices.view')
  );
create policy "invoices_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'invoices.upload')
  );
create policy "invoices_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'invoices.delete')
  );
