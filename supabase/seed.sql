-- seed.sql
-- Populates the permission catalog. These keys are referenced by
-- role_permissions and member_permission_overrides, so they must exist.
-- Idempotent: safe to run repeatedly.

insert into public.permissions (key, description) values
  ('companies.view',   'View companies'),
  ('companies.create', 'Create companies'),
  ('companies.update', 'Edit companies'),
  ('companies.delete', 'Delete companies'),
  ('contacts.view',    'View contacts'),
  ('contacts.create',  'Create contacts'),
  ('contacts.update',  'Edit contacts'),
  ('contacts.delete',  'Delete contacts'),
  ('deals.view',       'View deals'),
  ('deals.create',     'Create deals'),
  ('deals.update',     'Edit deals'),
  ('deals.delete',     'Delete deals'),
  ('tasks.view',       'View tasks'),
  ('tasks.create',     'Create tasks'),
  ('tasks.update',     'Edit tasks'),
  ('tasks.delete',     'Delete tasks'),
  ('notes.view',       'View notes'),
  ('notes.create',     'Create notes'),
  ('notes.update',     'Edit notes'),
  ('notes.delete',     'Delete notes'),
  ('notebook.view',    'View shared notes'),
  ('notebook.create',  'Create shared notes & folders'),
  ('notebook.update',  'Edit shared notes & folders'),
  ('notebook.delete',  'Delete shared notes & folders'),
  ('files.view',       'View files'),
  ('files.upload',     'Upload files'),
  ('files.delete',     'Delete files'),
  ('invoices.view',    'View invoices & receipts'),
  ('invoices.upload',  'Upload invoices & manage folders'),
  ('invoices.delete',  'Delete invoices & folders'),
  ('team.view',        'View team members'),
  ('team.invite',      'Invite team members'),
  ('team.edit_roles',  'Edit roles & permissions'),
  ('settings.view',    'View settings'),
  ('settings.update',  'Update settings'),
  ('ai.use',           'Use AI actions'),
  ('leads.view',       'View lead campaigns & discovered leads'),
  ('leads.create',     'Create campaigns & run lead discovery'),
  ('leads.update',     'Edit campaigns & review/approve leads'),
  ('leads.delete',     'Delete campaigns & leads'),
  ('leads.import',     'Import leads & enrich via Apollo.io (uses paid credits)'),
  ('email.view',       'View the mailbox & sent email'),
  ('email.send',       'Compose & send email'),
  ('notifications.view', 'View your notifications'),
  ('audit.view',       'View the workspace audit log'),
  ('settings.tokens',  'Create and revoke personal API tokens'),
  ('products.view',    'View products, price books & tax rates'),
  ('products.create',  'Create products & pricing'),
  ('products.update',  'Edit products & pricing'),
  ('products.delete',  'Delete products & pricing'),
  ('quotes.view',      'View quotes'),
  ('quotes.create',    'Create quotes'),
  ('quotes.update',    'Edit quotes'),
  ('quotes.delete',    'Delete quotes'),
  ('quotes.send',      'Send quotes & share links'),
  ('billing.view',     'View billing invoices & payments'),
  ('billing.create',   'Create billing invoices'),
  ('billing.update',   'Edit billing invoices'),
  ('billing.delete',   'Void or delete billing invoices'),
  ('billing.send',     'Send billing invoices & take payment'),
  ('calendar.view',    'View the calendar & events'),
  ('calendar.create',  'Create calendar events'),
  ('calendar.update',  'Edit calendar events'),
  ('calendar.delete',  'Delete calendar events'),
  ('scheduling.view',  'View public booking links'),
  ('scheduling.manage','Create & manage public booking links')
on conflict (key) do update set description = excluded.description;

-- Default role permissions template: grant a sensible read/write baseline to
-- every workspace's default "Member" role (excludes destructive + team/role
-- management + settings.update, which remain owner/full-access only).
-- Applied to any default role that has no permissions yet.
insert into public.role_permissions (role_id, permission_key, allowed)
select r.id, p.key, true
from public.roles r
cross join public.permissions p
where r.is_default
  and p.key in (
    'companies.view','companies.create','companies.update',
    'contacts.view','contacts.create','contacts.update',
    'deals.view','deals.create','deals.update',
    'tasks.view','tasks.create','tasks.update',
    'notes.view','notes.create','notes.update',
    'notebook.view','notebook.create','notebook.update',
    'files.view','files.upload',
    'invoices.view','invoices.upload',
    'team.view','settings.view','ai.use',
    'leads.view','leads.create','leads.update',
    'email.view','email.send',
    'notifications.view'
  )
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Named-role catalog for every workspace. Owner + Admin get full access; the
-- others are pre-scoped so an admin can drop a member into a role and they
-- immediately have the right buttons. Owner is left as the workspace's default
-- role so the schema invariant (exactly one default per workspace) holds.
-- Idempotent: the same block re-runs after every seed.
-- ---------------------------------------------------------------------------
do $$
declare
  w record;
  v_owner_role uuid;
  v_admin_role uuid;
  v_manager_role uuid;
  v_sales_role uuid;
  v_ro_role uuid;
begin
  for w in select id from public.workspaces loop
    -- Preserve any pre-existing default role; if none, we'll flip Owner to default.
    insert into public.roles (workspace_id, name) values (w.id, 'Owner')
      on conflict (workspace_id, name) do nothing;
    insert into public.roles (workspace_id, name) values (w.id, 'Admin')
      on conflict (workspace_id, name) do nothing;
    insert into public.roles (workspace_id, name) values (w.id, 'Manager')
      on conflict (workspace_id, name) do nothing;
    insert into public.roles (workspace_id, name) values (w.id, 'Sales Rep')
      on conflict (workspace_id, name) do nothing;
    insert into public.roles (workspace_id, name) values (w.id, 'Read-only')
      on conflict (workspace_id, name) do nothing;

    select id into v_owner_role   from public.roles where workspace_id = w.id and name = 'Owner';
    select id into v_admin_role   from public.roles where workspace_id = w.id and name = 'Admin';
    select id into v_manager_role from public.roles where workspace_id = w.id and name = 'Manager';
    select id into v_sales_role   from public.roles where workspace_id = w.id and name = 'Sales Rep';
    select id into v_ro_role      from public.roles where workspace_id = w.id and name = 'Read-only';

    -- Owner + Admin: every permission.
    insert into public.role_permissions (role_id, permission_key, allowed)
    select r.id, p.key, true
    from (values (v_owner_role), (v_admin_role)) r(id)
    cross join public.permissions p
    on conflict (role_id, permission_key) do nothing;

    -- Manager: full CRM + notifications + AI + email + team.view + settings.view.
    insert into public.role_permissions (role_id, permission_key, allowed)
    select v_manager_role, p.key, true
    from public.permissions p
    where p.key in (
      'companies.view','companies.create','companies.update','companies.delete',
      'contacts.view','contacts.create','contacts.update','contacts.delete',
      'deals.view','deals.create','deals.update','deals.delete',
      'tasks.view','tasks.create','tasks.update','tasks.delete',
      'notes.view','notes.create','notes.update','notes.delete',
      'notebook.view','notebook.create','notebook.update','notebook.delete',
      'files.view','files.upload','files.delete',
      'invoices.view','invoices.upload','invoices.delete',
      'leads.view','leads.create','leads.update','leads.delete','leads.import',
      'team.view','settings.view',
      'email.view','email.send','ai.use','notifications.view'
    )
    on conflict (role_id, permission_key) do nothing;

    -- Sales Rep: work their pipeline; no destructive actions.
    insert into public.role_permissions (role_id, permission_key, allowed)
    select v_sales_role, p.key, true
    from public.permissions p
    where p.key in (
      'companies.view','companies.create','companies.update',
      'contacts.view','contacts.create','contacts.update',
      'deals.view','deals.create','deals.update',
      'tasks.view','tasks.create','tasks.update',
      'notes.view','notes.create','notes.update',
      'notebook.view','notebook.create',
      'files.view','files.upload',
      'leads.view','leads.update',
      'email.view','email.send','ai.use','notifications.view'
    )
    on conflict (role_id, permission_key) do nothing;

    -- Read-only: view everything, change nothing.
    insert into public.role_permissions (role_id, permission_key, allowed)
    select v_ro_role, p.key, true
    from public.permissions p
    where p.key in (
      'companies.view','contacts.view','deals.view','tasks.view',
      'notes.view','notebook.view','files.view','invoices.view',
      'leads.view','team.view','email.view','notifications.view'
    )
    on conflict (role_id, permission_key) do nothing;
  end loop;
end $$;
