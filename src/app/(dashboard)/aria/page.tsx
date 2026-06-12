import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isAiConfigured } from "@/features/ai/gemini";
import { AriaChat } from "@/features/aria/components/aria-chat";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function AriaPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  const aiEnabled = isAiConfigured() && allowed.has("ai.use");

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
