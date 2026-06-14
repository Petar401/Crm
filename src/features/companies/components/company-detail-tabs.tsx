"use client";

import { useState } from "react";
import Link from "next/link";

import type {
  Activity,
  Company,
  Contact,
  Deal,
  DealStage,
  Note,
} from "@/lib/db/types";
import type { AttachmentWithUrl } from "@/features/attachments/queries";
import { formatCurrency } from "@/lib/utils/format";
import { NotesPanel } from "@/features/notes/components/notes-panel";
import { FilesPanel } from "@/features/attachments/components/files-panel";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { DealForm } from "@/features/deals/components/deal-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Briefcase, Plus } from "lucide-react";

interface Props {
  company: Company;
  contacts: Contact[];
  deals: Deal[];
  notes: Note[];
  attachments: AttachmentWithUrl[];
  activities: Activity[];
  stages: DealStage[];
  workspaceId: string;
  permissions: {
    notesCreate: boolean;
    notesDelete: boolean;
    filesUpload: boolean;
    filesDelete: boolean;
    contactsCreate: boolean;
    dealsCreate: boolean;
  };
  aiEnabled: boolean;
}

export function CompanyDetailTabs({
  company,
  contacts,
  deals,
  notes,
  attachments,
  activities,
  stages,
  workspaceId,
  permissions,
  aiEnabled,
}: Props) {
  const [addingContact, setAddingContact] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);

  const companyOption = [{ id: company.id, name: company.name }];
  const contactOptions = contacts.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    company_id: c.company_id,
  }));

  return (
    <Tabs defaultValue="contacts">
      <TabsList>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="contacts" className="pt-4">
        {permissions.contactsCreate && (
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAddingContact(true)}>
              <Plus className="size-4" />
              Add contact
            </Button>
          </div>
        )}
        {contacts.length === 0 ? (
          <EmptyState icon={Users} title="No contacts" />
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="hover:bg-muted/50 flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{contact.full_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {contact.job_title ?? contact.email ?? "—"}
                  </p>
                </div>
                {contact.is_primary && (
                  <span className="text-muted-foreground text-xs">Primary</span>
                )}
              </Link>
            ))}
          </div>
        )}
        {permissions.contactsCreate && (
          <ContactForm
            open={addingContact}
            onOpenChange={setAddingContact}
            companies={companyOption}
            defaultCompanyId={company.id}
          />
        )}
      </TabsContent>

      <TabsContent value="deals" className="pt-4">
        {permissions.dealsCreate && stages.length > 0 && (
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAddingDeal(true)}>
              <Plus className="size-4" />
              New deal
            </Button>
          </div>
        )}
        {deals.length === 0 ? (
          <EmptyState icon={Briefcase} title="No deals" />
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="hover:bg-muted/50 flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{deal.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatCurrency(deal.value, deal.currency)}
                  </p>
                </div>
                <StatusBadge status={deal.status} />
              </Link>
            ))}
          </div>
        )}
        {permissions.dealsCreate && stages.length > 0 && (
          <DealForm
            open={addingDeal}
            onOpenChange={setAddingDeal}
            companies={companyOption}
            contacts={contactOptions}
            stages={stages}
            defaultCompanyId={company.id}
          />
        )}
      </TabsContent>

      <TabsContent value="notes" className="pt-4">
        <NotesPanel
          notes={notes}
          entity={{ companyId: company.id }}
          canCreate={permissions.notesCreate}
          canDelete={permissions.notesDelete}
          aiEnabled={aiEnabled}
        />
      </TabsContent>

      <TabsContent value="files" className="pt-4">
        <FilesPanel
          attachments={attachments}
          workspaceId={workspaceId}
          entityType="company"
          entityId={company.id}
          canUpload={permissions.filesUpload}
          canDelete={permissions.filesDelete}
        />
      </TabsContent>

      <TabsContent value="activity" className="pt-4">
        <ActivityTimeline activities={activities} />
      </TabsContent>
    </Tabs>
  );
}
