import { PERMISSION_KEYS, type PermissionKey } from "@/lib/constants/permissions";

export const ROLE_NAMES = [
  "Owner",
  "Admin",
  "Manager",
  "Sales Rep",
  "Read-only",
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Role templates. Mirrored to the SQL side in `supabase/seed.sql` (the DO
 * block). If a permission is added or renamed in `PERMISSION_KEYS`, update
 * both places to stay in sync — the vitest test on this file will fail
 * loudly if a template references a key that no longer exists.
 */
export const ROLE_TEMPLATES: Record<RoleName, PermissionKey[]> = {
  Owner: [...PERMISSION_KEYS],
  Admin: [...PERMISSION_KEYS],
  Manager: [
    "companies.view", "companies.create", "companies.update", "companies.delete",
    "contacts.view", "contacts.create", "contacts.update", "contacts.delete",
    "deals.view", "deals.create", "deals.update", "deals.delete",
    "tasks.view", "tasks.create", "tasks.update", "tasks.delete",
    "notes.view", "notes.create", "notes.update", "notes.delete",
    "notebook.view", "notebook.create", "notebook.update", "notebook.delete",
    "files.view", "files.upload", "files.delete",
    "invoices.view", "invoices.upload", "invoices.delete",
    "leads.view", "leads.create", "leads.update", "leads.delete", "leads.import",
    "team.view", "settings.view",
    "email.view", "email.send", "ai.use", "notifications.view",
  ],
  "Sales Rep": [
    "companies.view", "companies.create", "companies.update",
    "contacts.view", "contacts.create", "contacts.update",
    "deals.view", "deals.create", "deals.update",
    "tasks.view", "tasks.create", "tasks.update",
    "notes.view", "notes.create", "notes.update",
    "notebook.view", "notebook.create",
    "files.view", "files.upload",
    "leads.view", "leads.update",
    "email.view", "email.send", "ai.use", "notifications.view",
  ],
  "Read-only": [
    "companies.view", "contacts.view", "deals.view", "tasks.view",
    "notes.view", "notebook.view", "files.view", "invoices.view",
    "leads.view", "team.view", "email.view", "notifications.view",
  ],
};
