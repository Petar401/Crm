import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlugZap } from "lucide-react";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { isApolloConfigured } from "@/features/apollo/settings-queries";
import { ApolloSearchPanel } from "@/features/apollo/components/apollo-search-panel";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ApolloSearchPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("leads.import")) redirect("/leads");

  const configured = await isApolloConfigured(ctx.workspace.id);

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/leads">
          <ArrowLeft className="size-4" />
          Leads
        </Link>
      </Button>

      <PageHeader
        title="Import from Apollo.io"
        description="Search Apollo's B2B database and import selected people as new leads"
      />

      {configured ? (
        <ApolloSearchPanel />
      ) : (
        <EmptyState
          icon={PlugZap}
          title="Apollo isn't connected yet"
          description="Add your Apollo.io API key in Settings to search and import leads."
          action={
            <Button asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
