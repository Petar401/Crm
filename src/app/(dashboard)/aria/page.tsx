import nextDynamic from "next/dynamic";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/settings-queries";
import { PageHeader } from "@/components/shared/page-header";

// AriaChat carries the streaming chat client, its markdown renderer and any
// downstream form logic. Splitting it into its own chunk keeps the initial
// route payload small — the page shell paints before the chat JS loads.
const AriaChat = nextDynamic(() =>
  import("@/features/aria/components/aria-chat").then((m) => ({
    default: m.AriaChat,
  }))
);

export const dynamic = "force-dynamic";

export default async function AriaPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  const aiEnabled = (await isAiConfigured(ctx.workspace.id)) && allowed.has("ai.use");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Aria"
        description="Your AI assistant — ask anything about your CRM"
      />
      <div className="min-h-0 flex-1">
        <AriaChat
          aiEnabled={aiEnabled}
          userName={ctx.profile?.full_name ?? ctx.email}
        />
      </div>
    </div>
  );
}
