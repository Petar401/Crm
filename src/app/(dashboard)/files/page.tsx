import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getAllAttachments } from "@/features/attachments/queries";
import { FilesGallery } from "@/features/attachments/components/files-gallery";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("files.view")) redirect("/");

  const attachments = await getAllAttachments(ctx.workspace.id);

  return (
    <div>
      <PageHeader
        title="Files"
        description="All files uploaded across your workspace"
      />
      <FilesGallery
        attachments={attachments}
        canDelete={allowed.has("files.delete")}
      />
    </div>
  );
}
