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
  "team.view",
  "team.invite",
  "team.edit_roles",
  "settings.view",
  "settings.update",
  "ai.use",
  "leads.view",
  "leads.create",
  "leads.update",
  "leads.delete",
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
    ],
  },
];

/** All permission definitions, flattened. */
export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap(
  (g) => g.permissions
);
