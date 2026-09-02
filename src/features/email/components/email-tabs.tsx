"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox as InboxIcon, RefreshCw, PenSquare, TriangleAlert } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { Email } from "@/lib/db/types";
import type { ContactEmailOption } from "@/features/email/queries";
import { MailboxList, type MailRow } from "./mailbox-list";
import { MessageView, type DisplayMessage } from "./message-view";
import { ComposeSheet } from "./compose-sheet";

interface InboxMessageDTO {
  uid: number;
  seen: boolean;
  from: string;
  fromName: string | null;
  subject: string;
  date: string | null;
  snippet: string;
  text: string | null;
  html: string | null;
}

type InboxState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; messages: InboxMessageDTO[] };

interface Props {
  canSend: boolean;
  sentEmails: Email[];
  contactOptions: ContactEmailOption[];
  companyOptions: { id: string; name: string }[];
}

export function EmailTabs({
  canSend,
  sentEmails,
  contactOptions,
  companyOptions,
}: Props) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<DisplayMessage | null>(null);
  const [inbox, setInbox] = useState<InboxState>({ status: "loading" });

  // Kept free of any synchronous setState so it is safe to call from an effect.
  const fetchInboxData = useCallback(async () => {
    try {
      const res = await fetch("/api/email/inbox", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setInbox({ status: "error", error: data?.error ?? "Failed to load inbox." });
        return;
      }
      setInbox({ status: "ready", messages: data.messages ?? [] });
    } catch {
      setInbox({ status: "error", error: "Could not reach the mail server." });
    }
  }, []);

  const loadInbox = useCallback(() => {
    setInbox({ status: "loading" });
    void fetchInboxData();
  }, [fetchInboxData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time live IMAP fetch on mount, an external system that can't be derived without an effect
    void fetchInboxData();
  }, [fetchInboxData]);

  const inboxRows: MailRow[] =
    inbox.status === "ready"
      ? inbox.messages.map((m) => ({
          key: String(m.uid),
          title: m.fromName || m.from || "(unknown sender)",
          subtitle: m.subject || "(no subject)",
          snippet: m.snippet,
          date: m.date,
          unread: !m.seen,
        }))
      : [];

  const sentRows: MailRow[] = sentEmails.map((e) => ({
    key: e.id,
    title: e.to_emails.length ? e.to_emails.join(", ") : "(no recipient)",
    subtitle: e.subject || "(no subject)",
    date: e.sent_at ?? e.created_at,
    failed: e.status === "failed",
  }));

  function openInboxMessage(key: string) {
    if (inbox.status !== "ready") return;
    const m = inbox.messages.find((x) => String(x.uid) === key);
    if (!m) return;
    setSelected({
      subject: m.subject,
      from: m.fromName ? `${m.fromName} <${m.from}>` : m.from,
      to: [],
      date: m.date,
      text: m.text,
      html: m.html,
    });
  }

  function openSentMessage(key: string) {
    const e = sentEmails.find((x) => x.id === key);
    if (!e) return;
    setSelected({
      subject: e.subject ?? "",
      from: e.from_email ?? "",
      to: e.to_emails,
      date: e.sent_at ?? e.created_at,
      text: e.body_text,
      html: e.body_html,
      status: e.status,
      error: e.error,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canSend && (
          <Button onClick={() => setComposeOpen(true)}>
            <PenSquare className="size-4" />
            Compose
          </Button>
        )}
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInbox}
              disabled={inbox.status === "loading"}
            >
              <RefreshCw
                className={`size-4 ${inbox.status === "loading" ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          {inbox.status === "loading" && (
            <div className="space-y-2 rounded-lg border p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {inbox.status === "error" && (
            <EmptyState
              icon={TriangleAlert}
              title="Couldn't load your inbox"
              description={inbox.error}
              action={
                <Button variant="outline" size="sm" onClick={loadInbox}>
                  Try again
                </Button>
              }
            />
          )}
          {inbox.status === "ready" &&
            (inboxRows.length ? (
              <MailboxList rows={inboxRows} onSelect={openInboxMessage} />
            ) : (
              <EmptyState
                icon={InboxIcon}
                title="Your inbox is empty"
                description="No recent messages in this mailbox."
              />
            ))}
        </TabsContent>

        <TabsContent value="sent">
          {sentRows.length ? (
            <MailboxList rows={sentRows} onSelect={openSentMessage} />
          ) : (
            <EmptyState
              icon={PenSquare}
              title="No sent email yet"
              description="Messages you send from the CRM will appear here."
              action={
                canSend ? (
                  <Button size="sm" onClick={() => setComposeOpen(true)}>
                    Compose
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <MessageView message={selected} onOpenChange={(o) => !o && setSelected(null)} />

      {canSend && (
        <ComposeSheet
          open={composeOpen}
          onOpenChange={setComposeOpen}
          contactOptions={contactOptions}
          companyOptions={companyOptions}
        />
      )}
    </div>
  );
}
