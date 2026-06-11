# CLAUDE.md

Guidance for working in this repository.

## What this is

A multi-user CRM (Next.js App Router + Supabase). See `README.md` for the full overview and
`supabase/README.md` for applying the database.

## Commands

- `pnpm dev` — run locally (needs `.env.local`)
- `pnpm build` — production build + type check
- `pnpm lint` — ESLint

## Architecture rules

- **Feature modules** live in `src/features/<name>` and own their `schemas.ts` (Zod),
  `queries.ts` (server reads), `actions.ts` (`"use server"` mutations), and `components/`.
- **Server Components by default.** Add `"use client"` only for interactivity.
- **Authorization in two places, never UI-only:**
  - Database: RLS policies + `has_permission(workspace_id, key)` (see `supabase/migrations/0005_rls.sql`).
  - App: `requirePermission(key)` in every mutating server action; `getPermissionSet()`/`allowed`
    for conditional UI. Permission keys are in `src/lib/constants/permissions.ts`.
- **Secrets are server-only.** Never import `lib/supabase/admin.ts` or use `GEMINI_API_KEY` in
  client code. Only `NEXT_PUBLIC_*` env vars may reach the browser.
- **Auth context:** `requireAuthContext()` (`src/lib/auth/session.ts`) gives `{ userId, email,
  profile, workspace, member }` and redirects to `/login` or `/onboarding` as needed.

## Adding a CRM entity

1. Add the table + RLS policy following the pattern in `0002_crm_core.sql` / `0005_rls.sql`.
2. Add a type to `src/lib/db/types.ts`.
3. Create `features/<entity>/{schemas,queries,actions}.ts` + components, mirroring `companies`.
4. Gate writes with `requirePermission` and add a nav item in `components/layout/sidebar.tsx`.

## Conventions

- Forms use React Hook Form + Zod via the shadcn `Form` wrapper. Avoid `z.coerce`/`z.transform`
  on form schemas (breaks `zodResolver` typing) — keep inputs as strings and convert in actions.
- Use `toast` (sonner) for action feedback and `router.refresh()` after mutations.
- Currency/date formatting helpers live in `src/lib/utils/format.ts`.
