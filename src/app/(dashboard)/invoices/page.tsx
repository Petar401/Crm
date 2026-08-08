import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  getInvoiceFolders,
  getInvoices,
} from "@/features/invoices/queries";
import { PageHeader } from "@/components/shared/page-header";
import type { InvoiceFolder } from "@/lib/db/types";

// InvoicesManager carries the upload widget, folder tree, and viewer client.
// Splits into its own chunk so the /invoices initial route payload stays small.
const InvoicesManager = nextDynamic(() =>
  import("@/features/invoices/components/invoices-manager").then((m) => ({
    default: m.InvoicesManager,
  }))
);

export const dynamic = "force-dynamic";

interface Crumb {
  id: string | null;
  name: string;
}

/** Walks parent links to build the breadcrumb trail for the open folder. */
function buildBreadcrumb(
  folders: InvoiceFolder[],
  folderId: string | null
): Crumb[] {
  const trail: Crumb[] = [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cursor = folderId ? byId.get(folderId) : undefined;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    trail.unshift({ id: cursor.id, name: cursor.name });
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  return [{ id: null, name: "Invoices" }, ...trail];
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("invoices.view")) redirect("/");

  const folders = await getInvoiceFolders(ctx.workspace.id);
  const { folder: folderParam } = await searchParams;
  // Only honor a folder id that actually exists in this workspace.
  const currentFolderId =
    folderParam && folders.some((f) => f.id === folderParam)
      ? folderParam
      : null;

  const invoices = await getInvoices(ctx.workspace.id, currentFolderId);

  const subfolders = folders.filter((f) => f.parent_id === currentFolderId);
  const breadcrumb = buildBreadcrumb(folders, currentFolderId);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Invoices"
          description="Upload invoices & receipts and organize them into folders by tax year and type"
        />
        <InvoicesManager
          workspaceId={ctx.workspace.id}
          currentFolderId={currentFolderId}
          breadcrumb={breadcrumb}
          folders={subfolders}
          invoices={invoices}
          canUpload={allowed.has("invoices.upload")}
          canDelete={allowed.has("invoices.delete")}
        />
      </div>
    </div>
  );
}
