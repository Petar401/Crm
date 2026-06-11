import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getDeals,
  getStages,
  getContactOptions,
} from "@/features/deals/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { DealsBoard } from "@/features/deals/components/deals-board";
import { PageHeader } from "@/components/shared/page-header";

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
