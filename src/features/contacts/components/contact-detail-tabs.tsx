"use client";

import type { Activity, Note } from "@/lib/db/types";
import type { AttachmentWithUrl } from "@/features/attachments/queries";
import { NotesPanel } from "@/features/notes/components/notes-panel";
import { FilesPanel } from "@/features/attachments/components/files-panel";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  contactId: string;
  notes: Note[];
  attachments: AttachmentWithUrl[];
  activities: Activity[];
  workspaceId: string;
  permissions: {
    notesCreate: boolean;
    notesDelete: boolean;
    filesUpload: boolean;
    filesDelete: boolean;
  };
  aiEnabled: boolean;
}

export function ContactDetailTabs({
  contactId,
  notes,
  attachments,
  activities,
  workspaceId,
  permissions,
  aiEnabled,
}: Props) {
  return (
    <Tabs defaultValue="notes">
      <TabsList>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="pt-4">
        <NotesPanel
          notes={notes}
          entity={{ contactId }}
          canCreate={permissions.notesCreate}
          canDelete={permissions.notesDelete}
          aiEnabled={aiEnabled}
        />
      </TabsContent>

      <TabsContent value="files" className="pt-4">
        <FilesPanel
          attachments={attachments}
          workspaceId={workspaceId}
          entityType="contact"
          entityId={contactId}
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
