import Link from "next/link";
import { Mail } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export function EmailNotConnected({ canManage }: { canManage: boolean }) {
  return (
    <EmptyState
      icon={Mail}
      title="No mailbox connected"
      description={
        canManage
          ? "Connect your business email account in Settings to send mail and view your inbox from the CRM."
          : "An admin needs to connect a business email account in Settings before the mailbox can be used."
      }
      action={
        canManage ? (
          <Button asChild>
            <Link href="/settings">Connect in Settings</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
