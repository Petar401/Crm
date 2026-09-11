"use client";

import { Reply } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface DisplayMessage {
  subject: string;
  from: string;
  to: string[];
  date: string | null;
  text: string | null;
  html: string | null;
  status?: "sent" | "failed";
  error?: string | null;
  replyTo: { to: string; subject: string };
}

interface Props {
  message: DisplayMessage | null;
  onOpenChange: (open: boolean) => void;
  onReply: (message: DisplayMessage) => void;
  canReply: boolean;
}

export function MessageView({ message, onOpenChange, onReply, canReply }: Props) {
  return (
    <Sheet open={!!message} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        {message && (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                <SheetTitle className="text-base leading-snug">
                  {message.subject || "(no subject)"}
                </SheetTitle>
                {canReply && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onReply(message)}
                  >
                    <Reply className="size-4" />
                    Reply
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-6">
              <div className="text-muted-foreground space-y-1 border-b pb-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">From:</span>{" "}
                  {message.from || "—"}
                </div>
                {message.to.length > 0 && (
                  <div>
                    <span className="font-medium text-foreground">To:</span>{" "}
                    {message.to.join(", ")}
                  </div>
                )}
                {message.date && (
                  <div>
                    <span className="font-medium text-foreground">Date:</span>{" "}
                    {new Date(message.date).toLocaleString()}
                  </div>
                )}
                {message.status === "failed" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="destructive">Failed</Badge>
                    {message.error && <span className="text-xs">{message.error}</span>}
                  </div>
                )}
              </div>
              {message.text ? (
                <pre className="text-foreground text-sm whitespace-pre-wrap break-words font-sans">
                  {message.text}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  This message has no plain-text body to display.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
