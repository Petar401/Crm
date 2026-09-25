import { describe, expect, it } from "vitest";

import { searchableEntities } from "./search-scope";
import type { PermissionKey } from "@/lib/constants/permissions";

describe("searchableEntities", () => {
  it("searches nothing without any view permission", () => {
    expect(searchableEntities(new Set<PermissionKey>())).toEqual({
      companies: false,
      contacts: false,
      deals: false,
      leads: false,
    });
  });

  it("only enables the entities the caller can view", () => {
    const scope = searchableEntities(
      new Set<PermissionKey>(["contacts.view", "leads.view", "deals.create"])
    );
    expect(scope).toEqual({
      companies: false,
      contacts: true,
      deals: false,
      leads: true,
    });
  });
});
