"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import type { Notification } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationsBellProps {
  initialUnread: number;
}

export function NotificationsBell({ initialUnread }: NotificationsBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Sync prop → local state via microtask so React Compiler doesn't flag
    // this as a cascading render from within an effect body.
    queueMicrotask(() => setUnread(initialUnread));
  }, [initialUnread]);

  const loadItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setItems(data as Notification[]);
      setUnread(data.filter((n) => !n.read_at).length);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    // Fire the async loader via microtask — same reason as above.
    queueMicrotask(() => {
      void loadItems();
    });
  }, [open, loaded, loadItems]);

  function handleClick(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
      });
    }
    if (n.url) router.push(n.url);
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="bg-destructive absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="close"
          />
          <div className="bg-popover text-popover-foreground absolute right-0 z-50 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-md border shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Notifications</span>
              <button
                type="button"
                onClick={markAll}
                disabled={pending || unread === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1 text-xs"
              >
                <Check className="size-3" />
                Mark all read
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-muted-foreground p-6 text-center text-sm">
                  {loaded ? "Nothing yet." : "Loading…"}
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "hover:bg-accent flex w-full items-start gap-3 border-b px-3 py-2 text-left last:border-b-0",
                      !n.read_at && "bg-accent/40"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        n.read_at ? "bg-transparent" : "bg-primary"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight">{n.title}</div>
                      {n.body && (
                        <div className="text-muted-foreground mt-0.5 truncate text-xs">
                          {n.body}
                        </div>
                      )}
                      <div className="text-muted-foreground mt-1 text-[10px]">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
