import { redirect } from "next/navigation";
import Link from "next/link";
import { PlugZap } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/settings-queries";
import { isApolloConfigured } from "@/features/apollo/settings-queries";
import { getCampaigns, getLeads } from "@/features/leads/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getStages } from "@/features/deals/queries";
import { CampaignsList } from "@/features/leads/components/campaigns-list";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

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
  const aiEnabled = (await isAiConfigured(ctx.workspace.id)) && allowed.has("ai.use");
  const canImport = allowed.has("leads.import");
  const apolloEnabled = canImport && (await isApolloConfigured(ctx.workspace.id));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leads"
        description="Automated lead discovery from OpenStreetMap, scored by AI"
        action={
          canImport ? (
            <Button variant="outline" asChild>
              <Link href="/leads/apollo">
                <PlugZap className="size-4" />
                Search Apollo
              </Link>
            </Button>
          ) : undefined
        }
      />

      <CampaignsList
        campaigns={campaigns}
        canCreate={allowed.has("leads.create")}
        canUpdate={allowed.has("leads.update")}
        canDelete={allowed.has("leads.delete")}
        apolloEnabled={apolloEnabled}
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
          apolloEnabled={apolloEnabled}
        />
      </div>
    </div>
  );
}
