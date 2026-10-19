import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { listLinksForUser } from "@/features/scheduling/queries";
import { LinksList } from "@/features/scheduling/components/links-list";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function SchedulingSettingsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("scheduling.view")) redirect("/settings");

  const links = await listLinksForUser(ctx.userId);
  const h = await headers();
  const publicBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${h.get("host") ?? "example.com"}`;

  return (
    <div>
      <PageHeader
        title="Scheduling"
        description="Create public booking links so people can find a slot on your calendar."
      />
      <LinksList
        links={links}
        canManage={allowed.has("scheduling.manage")}
        publicBaseUrl={publicBaseUrl}
        userTimezone={ctx.workspace.timezone ?? "Europe/London"}
      />
    </div>
  );
}
