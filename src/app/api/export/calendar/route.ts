import { NextResponse } from "next/server";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { exportCalendar } from "@/features/tools/exports";
import { auditExport, downloadResponse } from "@/features/tools/download";
import { getSiteUrl } from "@/lib/utils/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/export/calendar[?scope=mine] → .ics with open tasks (by due time)
 * and open deals (by expected close date) the member can view. `scope=mine`
 * limits it to tasks assigned to / deals owned by the current user.
 */
export async function GET(request: Request) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  const includeTasks = allowed.has("tasks.view");
  const includeDeals = allowed.has("deals.view");
  if (!includeTasks && !includeDeals) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const mine = new URL(request.url).searchParams.get("scope") === "mine";

  try {
    const { ics, count } = await exportCalendar(ctx.workspace.id, {
      includeTasks,
      includeDeals,
      onlyUserId: mine ? ctx.userId : null,
      origin: getSiteUrl(),
    });
    await auditExport({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
      kind: "calendar",
      count,
    });
    return downloadResponse(ics, {
      contentType: "text/calendar; charset=utf-8",
      baseName: mine ? "my-crm-calendar" : "crm-calendar",
      extension: "ics",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
