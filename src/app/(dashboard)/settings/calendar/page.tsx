import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { googleConfig, microsoftConfig } from "@/features/calendar-sync/config";
import { AccountsList } from "@/features/calendar-sync/components/accounts-list";
import { PageHeader } from "@/components/shared/page-header";
import type { CalendarAccount } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function CalendarSyncSettingsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("calendar.view")) redirect("/settings");

  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_accounts")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Calendar sync"
        description="Connect Google or Microsoft so /calendar shows your real availability."
      />
      <AccountsList
        accounts={(data ?? []) as CalendarAccount[]}
        googleConfigured={!!googleConfig()}
        microsoftConfigured={!!microsoftConfig()}
      />
    </div>
  );
}
