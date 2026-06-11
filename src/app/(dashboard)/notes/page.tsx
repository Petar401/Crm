import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getNoteFolders,
  getNotebookNotes,
} from "@/features/notebook/queries";
import { NotebookView } from "@/features/notebook/components/notebook-view";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();

  if (!allowed.has("notebook.view")) redirect("/");

  const [folders, notes] = await Promise.all([
    getNoteFolders(ctx.workspace.id),
    getNotebookNotes(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Shared notes and research for your team"
      />
      <NotebookView
        folders={folders}
        notes={notes}
        canCreate={allowed.has("notebook.create")}
        canUpdate={allowed.has("notebook.update")}
        canDelete={allowed.has("notebook.delete")}
      />
    </div>
  );
}
