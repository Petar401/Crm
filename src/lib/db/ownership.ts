import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Workspace-scoped tables a record may reference by id. */
export type OwnedTable =
  | "companies"
  | "contacts"
  | "deals"
  | "leads"
  | "deal_pipelines"
  | "deal_stages";

/**
 * Confirms every referenced id belongs to the workspace. Foreign keys only
 * prove a row exists somewhere, not that it lives in the caller's tenant, so
 * without this a client could link a note/task/deal to another workspace's
 * record (and probe which ids exist there). Empty/null refs are skipped.
 *
 * Returns the table of the first reference that fails, or null when all pass.
 */
export async function findForeignReference(
  supabase: Client,
  workspaceId: string,
  refs: ReadonlyArray<readonly [OwnedTable, string | null | undefined]>
): Promise<OwnedTable | null> {
  const checks = refs.filter(
    (ref): ref is readonly [OwnedTable, string] => Boolean(ref[1])
  );
  const results = await Promise.all(
    checks.map(async ([table, id]) => {
      const { data } = await supabase
        .from(table)
        .select("id")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle<{ id: string }>();
      return data ? null : table;
    })
  );
  return results.find((t) => t !== null) ?? null;
}

const LABELS: Record<OwnedTable, string> = {
  companies: "company",
  contacts: "contact",
  deals: "deal",
  leads: "lead",
  deal_pipelines: "pipeline",
  deal_stages: "pipeline stage",
};

/** User-facing error for a failed `findForeignReference` check. */
export function foreignReferenceError(table: OwnedTable): string {
  return `The linked ${LABELS[table]} was not found in this workspace.`;
}
