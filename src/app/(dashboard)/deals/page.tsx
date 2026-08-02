import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getDeals,
  getStages,
  getContactOptions,
} from "@/features/deals/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { PageHeader } from "@/components/shared/page-header";

// DealsBoard pulls the drag-and-drop kanban client into its own chunk.
const DealsBoard = nextDynamic(() =>
  import("@/features/deals/components/deals-board").then((m) => ({
    default: m.DealsBoard,
  }))
);

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("deals.view")) redirect("/");

  const [deals, stages, companies, contacts] = await Promise.all([
    getDeals(ctx.workspace.id),
    getStages(ctx.workspace.id),
    getCompanyOptions(ctx.workspace.id),
    getContactOptions(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader title="Deals" description="Your sales pipeline" />
      <DealsBoard
        deals={deals}
        stages={stages}
        companies={companies}
        contacts={contacts}
        canCreate={allowed.has("deals.create")}
        canUpdate={allowed.has("deals.update")}
      />
    </div>
  );
}
