"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FileSignature, Link2, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";

import { createShareLink, markSent, voidQuote } from "@/features/quotes/actions";
import type { Quote } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  quote: Quote;
  canUpdate: boolean;
  canSend: boolean;
}

export function QuoteDetailActions({ quote, canUpdate, canSend }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  function generateShare() {
    startTransition(async () => {
      const r = await createShareLink(quote.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.shareToken) {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setShareUrl(`${origin}/q/${r.shareToken}`);
        setShareOpen(true);
      }
      router.refresh();
    });
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  }

  function send() {
    startTransition(async () => {
      const r = await markSent(quote.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Marked as sent");
        router.refresh();
      }
    });
  }

  function voidIt() {
    startTransition(async () => {
      const r = await voidQuote(quote.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Quote voided");
        router.refresh();
      }
    });
  }

  const canEdit = quote.status === "draft" || quote.status === "sent";

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
          <Download className="size-4" />
          PDF
        </a>
      </Button>
      {canSend && quote.status !== "signed" && quote.status !== "void" && (
        <Button variant="outline" onClick={generateShare} disabled={pending}>
          <Link2 className="size-4" />
          Share link
        </Button>
      )}
      {canSend && quote.status === "draft" && (
        <Button variant="outline" onClick={send} disabled={pending}>
          <FileSignature className="size-4" />
          Mark sent
        </Button>
      )}
      {canUpdate && canEdit && (
        <Button onClick={() => router.push(`/quotes/${quote.id}/edit`)}>
          <Pencil className="size-4" />
          Edit
        </Button>
      )}
      {canUpdate && quote.status !== "void" && quote.status !== "signed" && (
        <Button variant="destructive" onClick={voidIt} disabled={pending}>
          <XCircle className="size-4" />
          Void
        </Button>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link generated</DialogTitle>
            <DialogDescription>
              Send this URL to your customer. Anyone with the link can view and
              sign the quote until it expires (30 days).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={shareUrl ?? ""} readOnly />
            <Button onClick={copyShareUrl} variant="secondary">
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
