# East Anglia AI Services — CRM

A secure, multi-user CRM built with **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**
on a **Supabase** backend (Postgres, Auth, Storage, Row Level Security), with optional
user-triggered **Gemini AI** actions executed server-side only.

## Features

- **Multi-user workspaces** — each team works in an isolated workspace; data is scoped by
  membership and enforced in the database with RLS.
- **CRM modules** — Companies, Contacts, Deals (Kanban + table), Tasks, Notes, Files, and a
  shared Activity timeline, plus a KPI Dashboard.
- **Custom permissions** — every member starts with **Full access**; switch it off to reveal a
  grouped checkbox matrix backed by per-member overrides. Enforced in server actions **and** RLS.
- **File uploads** — stored in Supabase Storage, scoped by workspace, with metadata records and
  image previews.
- **AI actions** — summarise notes, suggest a deal's next step, draft a follow-up, and generate a
  company brief. Runs only server-side, gated by the `ai.use` permission, disabled without a key.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Forms | React Hook Form + Zod |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| AI | Google Gemini (`@google/generative-ai`), server-side only |
| Hosting | Vercel (frontend) + Supabase (backend) |

## Project structure

```
src/
  app/
    (public)/        login, signup, forgot-password
    (dashboard)/     dashboard, companies, contacts, deals, tasks, files, settings
    onboarding/
  components/        ui/ (shadcn), layout/, shared/
  features/          auth, companies, contacts, deals, tasks, notes,
                     attachments, activities, ai, team, permissions, dashboard
  lib/               supabase/, auth/, db/, constants/, utils/
  middleware.ts      session refresh + route protection
supabase/
  migrations/        ordered SQL schema + RLS
  seed.sql           permission catalog + default role baseline
  README.md          how to apply the database
```

Server Components are the default; `"use client"` is used only for interactive pieces
(forms, tables, uploads, permission controls). Each feature owns its `schemas.ts`, `queries.ts`,
`actions.ts`, and `components/`.

## Getting started

### 1. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then apply the schema — see
[`supabase/README.md`](supabase/README.md). In short:

```bash
supabase link --project-ref <your-ref>
supabase db push
# then run supabase/seed.sql (CLI or dashboard SQL editor)
```

In **Authentication → Providers**, enable Email. For quick local testing you can disable
"Confirm email" so signup logs you straight in.

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon/public key
SUPABASE_SERVICE_ROLE_KEY=       # service role key (server-only)
GEMINI_API_KEY=                  # optional; enables AI features
```

Only `NEXT_PUBLIC_*` values are exposed to the browser. The service-role and Gemini keys
stay on the server.

### 3. Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>, sign up (this creates your workspace and makes you the owner),
and invite teammates from **Settings**.

## Security model

- **Authorization lives in the database.** RLS is enabled on every table; reads are scoped to
  workspace membership and writes additionally require the relevant permission via the
  `has_permission(workspace_id, key)` SQL function. The same logic is mirrored in
  `lib/auth/permissions.ts` for server actions and conditional UI.
- **Secrets stay server-side.** Gemini and the Supabase service-role key are never imported into
  client code; the service-role client is marked `server-only`.
- **Permission resolution order:** full access → member override → role default → deny. The
  workspace owner always retains full access.

## Deployment

- **Frontend:** deploy to [Vercel](https://vercel.com) — import the repo and add the four
  environment variables. (Cloudflare Pages works as an alternative.)
- **Backend:** your Supabase project hosts the database, auth, and storage.

## Acceptance checklist

- [x] Multi-user, workspace-isolated data (RLS)
- [x] Per-account login via Supabase Auth
- [x] Full access or custom checkbox permissions per member
- [x] Companies, contacts, deals, tasks, notes, files usable from the UI
- [x] File uploads with saved metadata
- [x] Gemini actions run only server-side, only for permitted users
- [x] API keys not exposed to the client bundle
- [x] Deployable on Vercel + Supabase
