# East Anglia AI Services — CRM

A secure, multi-user CRM built with **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**
on a **Supabase** backend (Postgres, Auth, Storage, Row Level Security), with optional
user-triggered **AI** actions (Groq or OpenRouter) executed server-side only.

## Features

- **Multi-user workspaces** — each team works in an isolated workspace; data is scoped by
  membership and enforced in the database with RLS.
- **CRM modules** — Companies, Contacts, Deals (Kanban + table), Tasks, Notes, Files, and a
  shared Activity timeline, plus a KPI Dashboard.
- **Custom permissions** — the workspace creator has **Full access**; new members get the
  workspace's default role (or full access, if the inviter grants it). Switch full access off to
  reveal a grouped checkbox matrix backed by per-member overrides. Enforced in server actions
  **and** RLS.
- **File uploads** — stored in Supabase Storage, scoped by workspace, with metadata records and
  image previews.
- **AI actions** — summarise notes, suggest a deal's next step, draft a follow-up, and generate a
  company brief. Runs only server-side, gated by the `ai.use` permission, disabled without a key.
- **Claude connector (MCP)** — connect Claude Desktop to the CRM so Claude can search records,
  create and update them, and log activity, all under your own permissions. See
  [Connect Claude Desktop](#connect-claude-desktop).

## Free built-in tools

These work out of the box, with no API key, signup or environment variable:

| Tool | Where | Powered by |
|---|---|---|
| **CSV export** of companies, contacts, deals, leads and tasks | *Export* menu on each list page | Built in (formula-injection safe, opens cleanly in Excel) |
| **CSV import** of companies and contacts | *Import CSV* on the Companies / Contacts pages | Built in (auto-maps common headers, skips duplicates) |
| **vCard export** (all contacts or one) | Contacts *Export* menu, contact page | Built in (vCard 3.0 for iOS, Android, Outlook) |
| **Calendar feed (.ics)** of open tasks and deal close dates | Tasks / Deals *Export* menu | Built in |
| **UK postcode lookup** — fills town, county and country | *Look up* next to postcode on company and lead forms | [postcodes.io](https://postcodes.io) (open data) |
| **UK bank holidays** — dashboard card, badge on tasks due on one | Dashboard, Tasks | [GOV.UK bank-holidays.json](https://www.gov.uk/bank-holidays.json) |
| **Map of companies and leads** by postcode | *Map* in the sidebar | postcodes.io + [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles via Leaflet |
| **Email domain check** — does the domain accept mail? | *Check email* on contact and lead pages | The server's own DNS (MX lookup) |

The postcode, bank-holiday and email-domain tools are also available to **Aria** and to the
**Claude connector** (`lookup_uk_postcode`, `uk_bank_holidays`, `check_email_domain`).
Exports require the matching *view* permission and are recorded in the audit log; imports require
*create*.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Forms | React Hook Form + Zod |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| AI | Groq or OpenRouter (OpenAI-compatible `openai` SDK), server-side only |
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
GROQ_API_KEY=                    # optional; default AI key (workspaces can set their own)
AI_KEY_ENCRYPTION_SECRET=        # optional; required if workspaces set their own AI key
```

Only `NEXT_PUBLIC_*` values are exposed to the browser. The service-role and Groq keys
stay on the server.

### 3. Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>, sign up (this creates your workspace and makes you the owner),
and invite teammates from **Settings**.

## Connect Claude Desktop

The CRM exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at
`/api/mcp`, so Claude can work directly with your data — "add Acme Ltd as a customer",
"what deals close this month?", "log that I called Jane".

### Prerequisites

- The app must be reachable at a **public HTTPS URL** — Claude connects from its own servers and
  cannot reach `localhost`. Deploy first (see [Deployment](#deployment)).
- The URL must **not sit behind a hosting-provider login wall.** On Vercel, *Deployment
  Protection → Vercel Authentication* covers every `*.vercel.app` URL by default (it exempts only
  custom domains); Claude would hit that SSO page instead of the app's own authorization. Either
  add a **custom domain** (exempt from protection) and point Claude at it, or turn Vercel
  Authentication off for the URL you give Claude.
- Set **`NEXT_PUBLIC_SITE_URL`** to that deployed origin, and add the same origin to your
  Supabase project's **Auth → URL Configuration → Redirect URLs**, so the browser sign-in during
  authorization returns to the app correctly.

Your MCP endpoint is `https://<your-app>/api/mcp` (also shown in **Settings → Connectors & API
tokens**).

### Connect (recommended: sign-in, no token)

Claude Desktop authorizes through the CRM's built-in OAuth flow — there is no token to paste.

1. In Claude Desktop, open **Settings → Connectors → Add custom connector** and enter the MCP URL
   `https://<your-app>/api/mcp`.
2. Click **Connect**. You'll be sent to the CRM in your browser to sign in and approve access.
3. Back in Claude, ask *"list my companies"* to confirm the connection.

### Alternative: personal access token (scripts, or older Desktop builds)

For automation, other MCP clients, or a Claude Desktop build without remote/OAuth connector
support, authenticate with a token instead:

1. In the CRM, go to **Settings → Connectors & API tokens** and create a token. Copy it — it's
   shown only once.
2. Point an MCP client at the endpoint with the token as a `Bearer` credential. For Claude Desktop,
   use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) in your config, e.g.:

   ```jsonc
   // claude_desktop_config.json
   {
     "mcpServers": {
       "crm": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "https://<your-app>/api/mcp",
           "--header",
           "Authorization: Bearer <your-token>"
         ]
       }
     }
   }
   ```

Notes:

- **Everything runs as you.** A connection is bound to your workspace membership, and every write
  goes through the same `requirePermission` checks as the UI — Claude can never exceed your own
  access.
- Revoke a token any time from **Settings → Connectors**; the connector loses access immediately.
  OAuth connections can likewise be removed from Claude Desktop.
- Claude's free plan allows one custom connector, which is enough for this.
- Tools available: search, list/get for companies, contacts, deals, tasks, notes, notebook notes,
  leads, pipelines and team members; `create_record` / `update_record` / `delete_record` across
  those entities; `log_activity`; email tools (`send_email`, `list_inbox_messages`,
  `list_sent_emails`); and the CRM's own AI helpers.

## Security model

- **Authorization lives in the database.** RLS is enabled on every table; reads are scoped to
  workspace membership and writes additionally require the relevant permission via the
  `has_permission(workspace_id, key)` SQL function. The same logic is mirrored in
  `lib/auth/permissions.ts` for server actions and conditional UI.
- **Secrets stay server-side.** AI provider keys and the Supabase service-role key are never imported into
  client code; the service-role client is marked `server-only`.
- **Permission resolution order:** full access → member override → role default → deny. The
  workspace owner always retains full access.
- **API tokens are stored hashed.** Only a SHA-256 digest of a personal access token is persisted;
  the plaintext is displayed once at creation and never recoverable. MCP requests resolve the token
  to its workspace member and run under that member's permission set. Because MCP requests use
  the service-role client, every MCP tool checks the member's `*.view` / write permission in
  application code (RLS is bypassed on that path).

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
- [x] AI actions run only server-side, only for permitted users
- [x] API keys not exposed to the client bundle
- [x] Deployable on Vercel + Supabase
