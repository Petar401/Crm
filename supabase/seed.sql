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
  ('team.view',        'View team members'),
  ('team.invite',      'Invite team members'),
  ('team.edit_roles',  'Edit roles & permissions'),
  ('settings.view',    'View settings'),
  ('settings.update',  'Update settings'),
  ('ai.use',           'Use AI actions'),
  ('leads.view',       'View lead campaigns & discovered leads'),
  ('leads.create',     'Create campaigns & run lead discovery'),
  ('leads.update',     'Edit campaigns & review/approve leads'),
  ('leads.delete',     'Delete campaigns & leads')
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
    'team.view','settings.view','ai.use',
    'leads.view','leads.create','leads.update'
  )
on conflict (role_id, permission_key) do nothing;
