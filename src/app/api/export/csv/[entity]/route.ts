import { NextResponse } from "next/server";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import {
  CSV_VIEW_PERMISSION,
  exportCsv,
  isCsvEntity,
} from "@/features/tools/exports";
import { auditExport, downloadResponse } from "@/features/tools/download";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/export/csv/{companies|contacts|deals|leads|tasks} → CSV file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  if (!isCsvEntity(entity)) {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has(CSV_VIEW_PERMISSION[entity])) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const { csv, count } = await exportCsv(entity, ctx.workspace.id);
    await auditExport({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
      kind: entity,
      count,
    });
    return downloadResponse(csv, {
      contentType: "text/csv; charset=utf-8",
      baseName: entity,
      extension: "csv",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
