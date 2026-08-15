import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Mail, Phone, MapPin } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/settings-queries";
import {
  getCompany,
  getCompanyContacts,
  getCompanyDeals,
} from "@/features/companies/queries";
import { getNotes } from "@/features/notes/queries";
import { getEntityAttachments } from "@/features/attachments/queries";
import { getEntityActivities } from "@/features/activities/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getStages } from "@/features/deals/queries";
import { formatCurrency } from "@/lib/utils/format";
import { CompanyDetailTabs } from "@/features/companies/components/company-detail-tabs";
import { CompanyDetailActions } from "@/features/companies/components/company-detail-actions";
import { AiPanel } from "@/features/ai/components/ai-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ctx, { allowed }] = await Promise.all([
    requireAuthContext(),
    getPermissionSet(),
  ]);
  if (!allowed.has("companies.view")) redirect("/");

  // Start every panel's fetch in parallel with the primary getCompany fetch.
  // Previously the page awaited the company row first, adding one round-trip
  // of latency before the panels could even start loading.
  const workspaceId = ctx.workspace.id;
  const [
    company,
    contacts,
    deals,
    notes,
    attachments,
    activities,
    members,
    stages,
  ] = await Promise.all([
    getCompany(workspaceId, id),
    getCompanyContacts(workspaceId, id),
    getCompanyDeals(workspaceId, id),
    getNotes(workspaceId, { companyId: id }),
    getEntityAttachments(workspaceId, "company", id),
    getEntityActivities(workspaceId, { companyId: id }),
    getMemberOptions(workspaceId),
    getStages(workspaceId),
  ]);
  if (!company) notFound();

  const aiEnabled = (await isAiConfigured(workspaceId)) && allowed.has("ai.use");

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/companies">
          <ArrowLeft className="size-4" />
          Companies
        </Link>
      </Button>

      <PageHeader
        title={company.name}
        description={company.industry ?? undefined}
        action={
          <CompanyDetailActions
            company={company}
            members={members}
            canUpdate={allowed.has("companies.update")}
            canDelete={allowed.has("companies.delete")}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CompanyDetailTabs
            company={company}
            contacts={contacts}
            deals={deals}
            notes={notes}
            attachments={attachments}
            activities={activities}
            stages={stages}
            workspaceId={ctx.workspace.id}
            permissions={{
              notesCreate: allowed.has("notes.create"),
              notesDelete: allowed.has("notes.delete"),
              filesUpload: allowed.has("files.upload"),
              filesDelete: allowed.has("files.delete"),
              contactsCreate: allowed.has("contacts.create"),
              dealsCreate: allowed.has("deals.create"),
            }}
            aiEnabled={aiEnabled}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 text-sm">
              {company.website && (
                <div className="flex items-center gap-2">
                  <Globe className="text-muted-foreground size-4" />
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2">
                  <Mail className="text-muted-foreground size-4" />
                  <span>{company.email}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="text-muted-foreground size-4" />
                  <span>{company.phone}</span>
                </div>
              )}
              {(company.city || company.country) && (
                <div className="flex items-center gap-2">
                  <MapPin className="text-muted-foreground size-4" />
                  <span>
                    {[company.address_line_1, company.city, company.postcode, company.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              <div className="text-muted-foreground border-t pt-3">
                Open deals value:{" "}
                <span className="text-foreground font-medium">
                  {formatCurrency(
                    deals
                      .filter((d) => d.status === "open")
                      .reduce((s, d) => s + (d.value ?? 0), 0)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {aiEnabled && (
            <AiPanel entityType="company" entityId={company.id} aiEnabled />
          )}
        </div>
      </div>
    </div>
  );
}
