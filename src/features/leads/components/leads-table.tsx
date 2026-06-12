"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Sparkles, Target, X } from "lucide-react";
import { toast } from "sonner";

import type { Lead } from "@/lib/db/types";
import { approveLead, rejectLead } from "@/features/leads/actions";
import { draftLeadEmail } from "@/features/ai/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LeadsTableProps {
  leads: Lead[];
  canUpdate: boolean;
  aiEnabled: boolean;
}

export function LeadsTable({ leads, canUpdate, aiEnabled }: LeadsTableProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [draftLead, setDraftLead] = useState<Lead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);

  function handleApprove(lead: Lead) {
    setProcessingId(lead.id);
    startTransition(async () => {
      const result = await approveLead(lead.id);
      setProcessingId(null);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${lead.company_name} added to companies`);
        router.refresh();
      }
    });
  }

  function handleReject(lead: Lead) {
    setProcessingId(lead.id);
    startTransition(async () => {
      const result = await rejectLead(lead.id);
      setProcessingId(null);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  async function handleDraft(lead: Lead) {
    setDraftLead(lead);
    setDraftText("");
    setDraftLoading(true);
    const result = await draftLeadEmail(lead.id);
    setDraftLoading(false);
    if (result.error) {
      toast.error(result.error);
      setDraftLead(null);
      return;
    }
    setDraftText(result.text ?? "");
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No leads to review"
        description="Run a campaign to discover businesses. New leads appear here for review."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <div className="font-medium">{lead.company_name}</div>
                {lead.website && (
                  <a
                    href={
                      lead.website.startsWith("http")
                        ? lead.website
                        : `https://${lead.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground text-xs hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.website}
                  </a>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {lead.contact_name ? (
                  <div>
                    <div>{lead.contact_name}</div>
                    {lead.contact_email && (
                      <div className="text-xs">{lead.contact_email}</div>
                    )}
                  </div>
                ) : (
                  (lead.email ?? lead.phone ?? "—")
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {[lead.city, lead.country].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell>
                {lead.match_score != null ? (
                  <Badge
                    variant="secondary"
                    title={lead.match_reason ?? undefined}
                  >
                    {lead.match_score}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {aiEnabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Draft email"
                      onClick={() => handleDraft(lead)}
                    >
                      <Mail className="size-4" />
                    </Button>
                  )}
                  {canUpdate && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Approve"
                        disabled={processingId === lead.id}
                        onClick={() => handleApprove(lead)}
                      >
                        <Check className="size-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reject"
                        disabled={processingId === lead.id}
                        onClick={() => handleReject(lead)}
                      >
                        <X className="size-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={!!draftLead}
        onOpenChange={(o) => !o && setDraftLead(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Outreach email</DialogTitle>
            <DialogDescription>
              AI draft for {draftLead?.company_name}. Review before sending.
            </DialogDescription>
          </DialogHeader>
          {draftLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Sparkles className="size-4 animate-pulse" />
              Drafting…
            </div>
          ) : (
            <>
              <div className="bg-muted/50 max-h-72 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
                {draftText}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(draftText);
                  toast.success("Copied");
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
