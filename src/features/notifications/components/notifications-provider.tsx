"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

interface Props {
  workspaceId: string;
  userId: string;
  children: React.ReactNode;
}

/**
 * Subscribes to `notifications` inserts addressed to the current user and
 * shows a toast when one arrives. Also refreshes the current route so the
 * bell badge (rendered server-side in the layout) updates without a manual
 * reload. Wraps the dashboard so the subscription lives as long as the user
 * is inside a workspace.
 */
export function NotificationsProvider({ workspaceId, userId, children }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: { title?: string; body?: string | null; url?: string | null } }) => {
          const n = payload.new;
          const url = n.url ?? undefined;
          toast(n.title ?? "Notification", {
            description: n.body ?? undefined,
            action: url
              ? {
                  label: "Open",
                  onClick: () => router.push(url),
                }
              : undefined,
          });
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, userId, router]);

  return <>{children}</>;
}
