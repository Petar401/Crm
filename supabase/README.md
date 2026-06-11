# Supabase setup

This directory contains the database schema, security policies, and seed data for
the CRM. Everything is plain SQL so you can apply it with the Supabase CLI **or**
by pasting into the dashboard SQL editor.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_identity.sql` | Profiles, workspaces, membership, signup trigger, `create_workspace_for_user` RPC |
| `migrations/0002_crm_core.sql` | Companies, contacts, pipelines, stages, deals |
| `migrations/0003_activity_files.sql` | Tasks, notes, activities, attachments |
| `migrations/0004_permissions.sql` | Permission catalog tables + `has_permission()` resolver |
| `migrations/0005_rls.sql` | Enables RLS, all policies, and the `attachments` storage bucket |
| `migrations/0006_hardening.sql` | Additional hardening |
| `migrations/0007_autoconfirm_users.sql` | Auto-confirm new signups |
| `migrations/0008_file_folders.sql` | Folders + workspace-level files for the Files manager |
| `seed.sql` | Permission catalog rows (required) + default-role baseline |

## Apply with the Supabase CLI (recommended)

```bash
# 1. Link to your project (or run `supabase start` for a local stack)
supabase link --project-ref <your-project-ref>

# 2. Push migrations
supabase db push

# 3. Seed the permission catalog
psql "$DATABASE_URL" -f supabase/seed.sql
# (or paste seed.sql into the dashboard SQL editor)
```

For a fully local stack: `supabase start` then `supabase db reset` (which runs
migrations and `seed.sql` automatically).

## Apply via the dashboard

Open **SQL Editor** and run, in order: `0001` → `0002` → `0003` → `0004` →
`0005` → `0006` → `0007` → `0008`, then `seed.sql`.

## After applying

1. In **Authentication → Providers**, ensure Email is enabled. For quick local
   testing you may disable "Confirm email" so signup logs in immediately.
2. Copy your project URL and keys into `.env.local` (see `.env.example`).
3. The `attachments` storage bucket is created by `0005_rls.sql` with private
   access; its policies scope objects by workspace.

## How authorization works

- Every table has RLS enabled. Reads are scoped to workspace membership; writes
  additionally require the relevant permission via `has_permission(workspace_id, key)`.
- `has_permission` resolves: **full access → member override → role → default deny**.
- New workspaces are created by `create_workspace_for_user()` which also creates a
  default pipeline, stages, a default role, and an owner membership with full access.
