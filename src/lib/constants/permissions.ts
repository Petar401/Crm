/**
 * Permission catalog — the single source of truth for permission keys, shared
 * by the UI (checkbox matrix) and server-side checks. Mirrors the rows seeded
 * into the `permissions` table (supabase/seed.sql).
 */

export const PERMISSION_KEYS = [
  "companies.view",
  "companies.create",
  "companies.update",
  "companies.delete",
  "contacts.view",
  "contacts.create",
  "contacts.update",
  "contacts.delete",
  "deals.view",
  "deals.create",
  "deals.update",
  "deals.delete",
  "tasks.view",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "notes.view",
  "notes.create",
  "notes.update",
  "notes.delete",
  "notebook.view",
  "notebook.create",
  "notebook.update",
  "notebook.delete",
  "files.view",
  "files.upload",
  "files.delete",
  "invoices.view",
  "invoices.upload",
  "invoices.delete",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "quotes.view",
  "quotes.create",
  "quotes.update",
  "quotes.delete",
  "quotes.send",
  "billing.view",
  "billing.create",
  "billing.update",
  "billing.delete",
  "billing.send",
  "calendar.view",
  "calendar.create",
  "calendar.update",
  "calendar.delete",
  "scheduling.view",
  "scheduling.manage",
  "team.view",
  "team.invite",
  "team.edit_roles",
  "settings.view",
  "settings.update",
  "settings.tokens",
  "ai.use",
  "leads.view",
  "leads.create",
  "leads.update",
  "leads.delete",
  "leads.import",
  "email.view",
  "email.send",
  "notifications.view",
  "audit.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDef {
  key: PermissionKey;
  description: string;
}

export interface PermissionGroup {
  label: string;
  permissions: PermissionDef[];
}

/** Grouped for the checkbox matrix UI in Settings. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Companies",
    permissions: [
      { key: "companies.view", description: "View companies" },
      { key: "companies.create", description: "Create companies" },
      { key: "companies.update", description: "Edit companies" },
      { key: "companies.delete", description: "Delete companies" },
    ],
  },
  {
    label: "Contacts",
    permissions: [
      { key: "contacts.view", description: "View contacts" },
      { key: "contacts.create", description: "Create contacts" },
      { key: "contacts.update", description: "Edit contacts" },
      { key: "contacts.delete", description: "Delete contacts" },
    ],
  },
  {
    label: "Deals",
    permissions: [
      { key: "deals.view", description: "View deals" },
      { key: "deals.create", description: "Create deals" },
      { key: "deals.update", description: "Edit deals" },
      { key: "deals.delete", description: "Delete deals" },
    ],
  },
  {
    label: "Tasks",
    permissions: [
      { key: "tasks.view", description: "View tasks" },
      { key: "tasks.create", description: "Create tasks" },
      { key: "tasks.update", description: "Edit tasks" },
      { key: "tasks.delete", description: "Delete tasks" },
    ],
  },
  {
    label: "Notes",
    permissions: [
      { key: "notes.view", description: "View notes" },
      { key: "notes.create", description: "Create notes" },
      { key: "notes.update", description: "Edit notes" },
      { key: "notes.delete", description: "Delete notes" },
    ],
  },
  {
    label: "Notebook",
    permissions: [
      { key: "notebook.view", description: "View shared notes" },
      { key: "notebook.create", description: "Create shared notes & folders" },
      { key: "notebook.update", description: "Edit shared notes & folders" },
      { key: "notebook.delete", description: "Delete shared notes & folders" },
    ],
  },
  {
    label: "Files",
    permissions: [
      { key: "files.view", description: "View files" },
      { key: "files.upload", description: "Upload files" },
      { key: "files.delete", description: "Delete files" },
    ],
  },
  {
    label: "Invoices",
    permissions: [
      { key: "invoices.view", description: "View invoices & receipts" },
      { key: "invoices.upload", description: "Upload invoices & manage folders" },
      { key: "invoices.delete", description: "Delete invoices & folders" },
    ],
  },
  {
    label: "Products",
    permissions: [
      { key: "products.view", description: "View products, price books & tax rates" },
      { key: "products.create", description: "Create products & pricing" },
      { key: "products.update", description: "Edit products & pricing" },
      { key: "products.delete", description: "Delete products & pricing" },
    ],
  },
  {
    label: "Quotes",
    permissions: [
      { key: "quotes.view", description: "View quotes" },
      { key: "quotes.create", description: "Create quotes" },
      { key: "quotes.update", description: "Edit quotes" },
      { key: "quotes.delete", description: "Delete quotes" },
      { key: "quotes.send", description: "Send quotes & share links" },
    ],
  },
  {
    label: "Billing",
    permissions: [
      { key: "billing.view", description: "View billing invoices & payments" },
      { key: "billing.create", description: "Create billing invoices" },
      { key: "billing.update", description: "Edit billing invoices" },
      { key: "billing.delete", description: "Void or delete billing invoices" },
      { key: "billing.send", description: "Send billing invoices & take payment" },
    ],
  },
  {
    label: "Calendar",
    permissions: [
      { key: "calendar.view", description: "View the calendar & events" },
      { key: "calendar.create", description: "Create calendar events" },
      { key: "calendar.update", description: "Edit calendar events" },
      { key: "calendar.delete", description: "Delete calendar events" },
    ],
  },
  {
    label: "Scheduling",
    permissions: [
      { key: "scheduling.view", description: "View public booking links" },
      { key: "scheduling.manage", description: "Create & manage public booking links" },
    ],
  },
  {
    label: "Team",
    permissions: [
      { key: "team.view", description: "View team members" },
      { key: "team.invite", description: "Invite team members" },
      { key: "team.edit_roles", description: "Edit roles & permissions" },
    ],
  },
  {
    label: "Settings",
    permissions: [
      { key: "settings.view", description: "View settings" },
      { key: "settings.update", description: "Update settings" },
      {
        key: "settings.tokens",
        description: "Create and revoke personal API tokens",
      },
    ],
  },
  {
    label: "AI",
    permissions: [{ key: "ai.use", description: "Use AI actions" }],
  },
  {
    label: "Leads",
    permissions: [
      { key: "leads.view", description: "View campaigns & discovered leads" },
      { key: "leads.create", description: "Create campaigns & run discovery" },
      { key: "leads.update", description: "Edit campaigns & review leads" },
      { key: "leads.delete", description: "Delete campaigns & leads" },
      {
        key: "leads.import",
        description: "Import leads & enrich via Apollo.io (uses paid credits)",
      },
    ],
  },
  {
    label: "Email",
    permissions: [
      { key: "email.view", description: "View the mailbox & sent email" },
      { key: "email.send", description: "Compose & send email" },
    ],
  },
  {
    label: "Notifications",
    permissions: [
      { key: "notifications.view", description: "View your notifications" },
    ],
  },
  {
    label: "Audit",
    permissions: [
      { key: "audit.view", description: "View the workspace audit log" },
    ],
  },
];

/** All permission definitions, flattened. */
export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap(
  (g) => g.permissions
);
