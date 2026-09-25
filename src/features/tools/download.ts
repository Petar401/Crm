import "server-only";

import { auditLog } from "@/features/audit/log";

/** UTC date for file names, e.g. "2026-09-25". */
function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A file download response. Never cached: exports contain private data. */
export function downloadResponse(
  body: string,
  opts: { contentType: string; baseName: string; extension: string }
): Response {
  const fileName = `${opts.baseName}-${stamp()}.${opts.extension}`;
  return new Response(body, {
    headers: {
      "content-type": opts.contentType,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Records an export in the audit log (bulk data leaving the CRM). */
export async function auditExport(params: {
  workspaceId: string;
  userId: string;
  kind: string;
  count: number;
}): Promise<void> {
  await auditLog({
    workspaceId: params.workspaceId,
    actorUserId: params.userId,
    action: "records.exported",
    entityType: params.kind,
    after: { count: params.count },
  });
}
