import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getNoteFolders,
  getNotebookNotes,
} from "@/features/notebook/queries";
import { PageHeader } from "@/components/shared/page-header";

// Notebook view bundles the editor + folder tree. Splitting keeps other
// dashboard routes from carrying its JS.
const NotebookView = nextDynamic(() =>
  import("@/features/notebook/components/notebook-view").then((m) => ({
    default: m.NotebookView,
  }))
);

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
