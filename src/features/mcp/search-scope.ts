import type { PermissionKey } from "@/lib/constants/permissions";

export interface SearchScope {
  companies: boolean;
  contacts: boolean;
  deals: boolean;
  leads: boolean;
}

/**
 * Which entities the MCP `search` tool may query for a caller. The MCP path
 * runs on the service-role client (RLS bypassed), so this is the only thing
 * standing between a restricted member and records they cannot see in the UI.
 */
export function searchableEntities(
  allowed: ReadonlySet<PermissionKey>
): SearchScope {
  return {
    companies: allowed.has("companies.view"),
    contacts: allowed.has("contacts.view"),
    deals: allowed.has("deals.view"),
    leads: allowed.has("leads.view"),
  };
}
