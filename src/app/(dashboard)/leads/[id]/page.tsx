import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, User } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { getLead } from "@/features/leads/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getStages } from "@/features/deals/queries";
import { getNotes } from "@/features/notes/queries";
import { getEntityAttachments } from "@/features/attachments/queries";
import { getEntityActivities } from "@/features/activities/queries";
import { LeadDetailTabs } from "@/features/leads/components/lead-detail-tabs";
import { LeadDetailActions } from "@/features/leads/components/lead-detail-actions";
import {
  scoreTier,
  SCORE_TIER_LABEL,
  SCORE_TIER_STYLE,
} from "@/features/leads/score";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("leads.view")) redirect("/");

  const lead = await getLead(ctx.workspace.id, id);
  if (!lead) notFound();

  const [members, stages, notes, attachments, activities] = await Promise.all([
    getMemberOptions(ctx.workspace.id),
    getStages(ctx.workspace.id),
    getNotes(ctx.workspace.id, { leadId: id }),
    getEntityAttachments(ctx.workspace.id, "lead", id),
    getEntityActivities(ctx.workspace.id, { leadId: id }),
  ]);

  const aiEnabled = isAiConfigured() && allowed.has("ai.use");
  const ownerName =
    members.find((m) => m.userId === lead.owner_user_id)?.name ?? "Unassigned";
  const tier = scoreTier(lead.match_score);

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/leads">
          <ArrowLeft className="size-4" />
          Leads
        </Link>
      </Button>

      <PageHeader
        title={lead.company_name}
        description={lead.industry ?? lead.website ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <LeadDetailActions
              lead={lead}
              members={members}
              stages={stages}
              canUpdate={allowed.has("leads.update")}
              canDelete={allowed.has("leads.delete")}
              canCreateDeal={allowed.has("deals.create")}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeadDetailTabs
            leadId={lead.id}
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
              <Row label="Owner" value={ownerName} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Score</span>
                {lead.match_score != null && tier ? (
                  <Badge
                    variant="secondary"
                    className={cn(SCORE_TIER_STYLE[tier])}
                  >
                    {lead.match_score} · {SCORE_TIER_LABEL[tier]}
                  </Badge>
                ) : (
                  <span>—</span>
                )}
              </div>
              <Row label="Source" value={lead.source} />
              {lead.campaign && (
                <Row label="Campaign" value={lead.campaign.name} />
              )}
              <Row
                label="Location"
                value={
                  [lead.city, lead.country].filter(Boolean).join(", ") || "—"
                }
              />
              {lead.website && (
                <Row label="Website" value={lead.website} />
              )}
              {lead.phone && <Row label="Phone" value={lead.phone} />}
              {lead.email && <Row label="Email" value={lead.email} />}
              {lead.contact_name && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground text-xs">Contact</p>
                  <p className="mt-1">{lead.contact_name}</p>
                  {lead.job_title && (
                    <p className="text-muted-foreground text-xs">
                      {lead.job_title}
                    </p>
                  )}
                  {lead.contact_email && (
                    <p className="text-muted-foreground text-xs">
                      {lead.contact_email}
                    </p>
                  )}
                </div>
              )}
              {lead.match_reason && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground text-xs">Why this fit</p>
                  <p className="mt-1">{lead.match_reason}</p>
                </div>
              )}
              {(lead.company || lead.contact) && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs">Converted to</p>
                  {lead.company && (
                    <Link
                      href={`/companies/${lead.company.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Building2 className="text-muted-foreground size-4" />
                      {lead.company.name}
                    </Link>
                  )}
                  {lead.contact && (
                    <Link
                      href={`/contacts/${lead.contact.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <User className="text-muted-foreground size-4" />
                      {lead.contact.full_name}
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
