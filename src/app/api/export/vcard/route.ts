import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { exportVCards } from "@/features/tools/exports";
import { auditExport, downloadResponse } from "@/features/tools/download";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/export/vcard[?id=<contact id>] → .vcf address-book file. */
export async function GET(request: Request) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("contacts.view")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const rawId = new URL(request.url).searchParams.get("id");
  const id = rawId ? z.string().uuid().safeParse(rawId) : null;
  if (id && !id.success) {
    return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
  }

  try {
    const result = await exportVCards(ctx.workspace.id, id?.data);
    if (!result) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    await auditExport({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
      kind: "contacts.vcard",
      count: result.count,
    });
    return downloadResponse(result.vcf, {
      contentType: "text/vcard; charset=utf-8",
      baseName: id ? "contact" : "contacts",
      extension: "vcf",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
