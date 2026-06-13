import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { getCampaigns, getLeads } from "@/features/leads/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getStages } from "@/features/deals/queries";
import { CampaignsList } from "@/features/leads/components/campaigns-list";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();

  if (!allowed.has("leads.view")) redirect("/");

  const [campaigns, leads, members, stages] = await Promise.all([
    getCampaigns(ctx.workspace.id),
    getLeads(ctx.workspace.id),
    getMemberOptions(ctx.workspace.id),
    getStages(ctx.workspace.id),
  ]);
  const aiEnabled = isAiConfigured() && allowed.has("ai.use");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leads"
        description="Automated lead discovery from OpenStreetMap, scored by AI"
      />

      <CampaignsList
        campaigns={campaigns}
        canCreate={allowed.has("leads.create")}
        canUpdate={allowed.has("leads.update")}
        canDelete={allowed.has("leads.delete")}
      />

      <div className="space-y-4">
        <h2 className="text-sm font-medium">Review queue</h2>
        <LeadsTable
          leads={leads}
          members={members}
          stages={stages}
          currentUserId={ctx.userId}
          canCreate={allowed.has("leads.create")}
          canUpdate={allowed.has("leads.update")}
          canDelete={allowed.has("leads.delete")}
          canCreateDeal={allowed.has("deals.create")}
          aiEnabled={aiEnabled}
        />
      </div>
    </div>
  );
}
