import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Briefcase, Link2 } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { getContact } from "@/features/contacts/queries";
import { getNotes } from "@/features/notes/queries";
import { getEntityAttachments } from "@/features/attachments/queries";
import { getEntityActivities } from "@/features/activities/queries";
import { ContactDetailTabs } from "@/features/contacts/components/contact-detail-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("contacts.view")) redirect("/");

  const contact = await getContact(ctx.workspace.id, id);
  if (!contact) notFound();

  const [notes, attachments, activities] = await Promise.all([
    getNotes(ctx.workspace.id, { contactId: id }),
    getEntityAttachments(ctx.workspace.id, "contact", id),
    getEntityActivities(ctx.workspace.id, { contactId: id }),
  ]);

  const aiEnabled = isAiConfigured() && allowed.has("ai.use");

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/contacts">
          <ArrowLeft className="size-4" />
          Contacts
        </Link>
      </Button>

      <PageHeader
        title={contact.full_name}
        description={contact.job_title ?? undefined}
        action={
          contact.is_primary ? <Badge variant="secondary">Primary</Badge> : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactDetailTabs
            contactId={contact.id}
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

        <div>
          <Card>
            <CardContent className="space-y-3 text-sm">
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Briefcase className="text-muted-foreground size-4" />
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="text-muted-foreground size-4" />
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="text-muted-foreground size-4" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.linkedin_url && (
                <div className="flex items-center gap-2">
                  <Link2 className="text-muted-foreground size-4" />
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    LinkedIn
                  </a>
                </div>
              )}
              <div className="text-muted-foreground border-t pt-3 capitalize">
                Role: {contact.contact_role.replace(/_/g, " ")}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
