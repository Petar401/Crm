"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";

import type { CalendarAccount } from "@/lib/db/types";
import { disconnectAccount, syncNow } from "@/features/calendar-sync/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";

interface Props {
  accounts: CalendarAccount[];
  googleConfigured: boolean;
  microsoftConfigured: boolean;
}

export function AccountsList({
  accounts,
  googleConfigured,
  microsoftConfigured,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function connect(provider: "google" | "microsoft") {
    window.location.href = `/api/calendar/oauth/${provider}/start`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect a calendar</CardTitle>
          <CardDescription>
            Two-way sync with Google Calendar or Microsoft Outlook (via
            Microsoft Graph). Events flow both ways so /calendar always shows
            your real availability, and slots offered by your public booking
            links respect it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => connect("google")}
            disabled={!googleConfigured}
          >
            Connect Google
          </Button>
          <Button
            variant="outline"
            onClick={() => connect("microsoft")}
            disabled={!microsoftConfigured}
          >
            Connect Microsoft
          </Button>
          {!googleConfigured && !microsoftConfigured && (
            <p className="text-muted-foreground text-xs">
              No providers configured. Set{" "}
              <code>GOOGLE_OAUTH_CLIENT_ID/SECRET</code> or{" "}
              <code>MICROSOFT_OAUTH_CLIENT_ID/SECRET</code> in the environment
              to enable them.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You haven&apos;t connected a calendar yet.
            </p>
          ) : (
            accounts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {a.provider}
                    </Badge>
                    <span className="font-medium">
                      {a.external_account_email}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Last sync:{" "}
                    {a.last_sync_at ? formatDateTime(a.last_sync_at) : "never"}
                    {a.last_sync_error && (
                      <span className="ml-2 text-red-600">
                        · {a.last_sync_error}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await syncNow(a.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success(
                            r.synced != null
                              ? `Synced ${r.synced} events`
                              : "Sync complete"
                          );
                          router.refresh();
                        }
                      })
                    }
                    disabled={pending}
                  >
                    <RefreshCw className="size-4" />
                    Sync now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await disconnectAccount(a.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Disconnected");
                          router.refresh();
                        }
                      })
                    }
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
