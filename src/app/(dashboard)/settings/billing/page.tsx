import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getBillingSettings } from "@/features/stripe/settings";
import { BillingSettingsForm } from "@/features/stripe/components/billing-settings-form";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("settings.update") || !allowed.has("billing.view")) {
    redirect("/settings");
  }

  const settings = await getBillingSettings(ctx.workspace.id);
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${h.get("host") ?? "example.com"}`;
  const webhookUrl = settings?.webhook_endpoint_slug
    ? `${origin}/api/billing/stripe/webhook/${settings.webhook_endpoint_slug}`
    : null;

  return (
    <div>
      <PageHeader
        title="Billing & Stripe"
        description="Payment collection, dunning and won-deal automation."
      />
      <BillingSettingsForm settings={settings} webhookUrl={webhookUrl} />
    </div>
  );
}
