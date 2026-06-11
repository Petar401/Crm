import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { getDeal, getStages } from "@/features/deals/queries";
import { getNotes } from "@/features/notes/queries";
import { getEntityAttachments } from "@/features/attachments/queries";
import { getEntityActivities } from "@/features/activities/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { DealDetailTabs } from "@/features/deals/components/deal-detail-tabs";
import { AiPanel } from "@/features/ai/components/ai-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("deals.view")) redirect("/");

  const deal = await getDeal(ctx.workspace.id, id);
  if (!deal) notFound();

  const [stages, notes, attachments, activities] = await Promise.all([
    getStages(ctx.workspace.id),
    getNotes(ctx.workspace.id, { dealId: id }),
    getEntityAttachments(ctx.workspace.id, "deal", id),
    getEntityActivities(ctx.workspace.id, { dealId: id }),
  ]);

  const stageName = stages.find((s) => s.id === deal.stage_id)?.name ?? "—";
  const aiEnabled = isAiConfigured() && allowed.has("ai.use");

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/deals">
          <ArrowLeft className="size-4" />
          Deals
        </Link>
      </Button>

      <PageHeader
        title={deal.name}
        description={formatCurrency(deal.value, deal.currency)}
        action={<StatusBadge status={deal.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DealDetailTabs
            dealId={deal.id}
            notes={notes}
            attachments={attachments}
            activities={activities}
            workspaceId={ctx.workspace.id}
            permissions={{
              notesCreate: allowed.has("notes.create"),
              notesDelete: allowed.has("notes.delete"),
              filesUpload: allowed.has("files.upload"),
              filesDelete: allowed.has("files.delete"),
            }}
            aiEnabled={aiEnabled}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 text-sm">
              {deal.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="text-muted-foreground size-4" />
                  <Link
                    href={`/companies/${deal.company.id}`}
                    className="hover:underline"
                  >
                    {deal.company.name}
                  </Link>
                </div>
              )}
              <Row label="Stage" value={stageName} />
              <Row
                label="Probability"
                value={deal.probability != null ? `${deal.probability}%` : "—"}
              />
              <Row
                label="Expected close"
                value={formatDate(deal.expected_close_date)}
              />
              {deal.source && <Row label="Source" value={deal.source} />}
              {deal.next_step && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground text-xs">Next step</p>
                  <p className="mt-1">{deal.next_step}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {aiEnabled && (
            <AiPanel entityType="deal" entityId={deal.id} aiEnabled />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
