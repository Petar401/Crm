"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { DealStage, Lead, LeadStatus } from "@/lib/db/types";
import type { MemberOption } from "@/features/team/queries";
import {
  bulkApproveLeads,
  bulkRejectLeads,
  deleteLead,
  rejectLead,
} from "@/features/leads/actions";
import { draftLeadEmail } from "@/features/ai/actions";
import { scoreTier, SCORE_TIER_LABEL, SCORE_TIER_STYLE } from "@/features/leads/score";
import { LeadForm } from "@/features/leads/components/lead-form";
import { ConvertLeadDialog } from "@/features/leads/components/convert-lead-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadsTableProps {
  leads: Lead[];
  members: MemberOption[];
  stages: DealStage[];
  currentUserId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canCreateDeal: boolean;
  aiEnabled: boolean;
}

type SortKey = "score" | "newest" | "name";

function ScoreBadge({ score }: { score: number | null }) {
  const tier = scoreTier(score);
  if (tier == null || score == null)
    return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="secondary" className={cn(SCORE_TIER_STYLE[tier])}>
      {score} · {SCORE_TIER_LABEL[tier]}
    </Badge>
  );
}

export function LeadsTable({
  leads,
  members,
  stages,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
  canCreateDeal,
  aiEnabled,
}: LeadsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus>("pending");
  const [sort, setSort] = useState<SortKey>("score");
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);

  const [draftLead, setDraftLead] = useState<Lead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);

  const counts = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      converted: 0,
    };
    for (const l of leads) c[l.status] += 1;
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = leads.filter((l) => {
      if (l.status !== status) return false;
      if (mineOnly && l.owner_user_id !== currentUserId) return false;
      if (!q) return true;
      return [l.company_name, l.contact_name, l.city, l.industry]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    const sorted = [...filtered];
    if (sort === "score") {
      sorted.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
    } else if (sort === "newest") {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    }
    return sorted;
  }, [leads, search, status, mineOnly, sort, currentUserId]);

  const selectedIds = useMemo(
    () => visible.filter((l) => selected.has(l.id)).map((l) => l.id),
    [visible, selected]
  );
  const allChecked = visible.length > 0 && selectedIds.length === visible.length;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) visible.forEach((l) => next.delete(l.id));
      else visible.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

  function handleBulk(kind: "approve" | "reject") {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const result =
        kind === "approve"
          ? await bulkApproveLeads(selectedIds)
          : await bulkRejectLeads(selectedIds);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          `${result.count ?? 0} lead${result.count === 1 ? "" : "s"} ${
            kind === "approve" ? "converted" : "rejected"
          }`
        );
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteLead(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Lead deleted");
      router.refresh();
    }
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="converted">
              Converted ({counts.converted})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({counts.rejected})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New lead
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search company, contact, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Top score</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name">Company A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={mineOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setMineOnly((v) => !v)}
        >
          My leads
        </Button>
        {canUpdate && selectedIds.length > 0 && status === "pending" && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {selectedIds.length} selected
            </span>
            <Button size="sm" onClick={() => handleBulk("approve")}>
              <Check className="size-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulk("reject")}
            >
              <X className="size-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads here"
          description="Run a campaign or add a lead manually. New leads appear here for review."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canUpdate && status === "pending" && (
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                )}
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  {canUpdate && status === "pending" && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">{lead.company_name}</div>
                    {lead.website && (
                      <span className="text-muted-foreground text-xs">
                        {lead.website}
                      </span>
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
                    <ScoreBadge score={lead.match_score} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
                      {canUpdate && lead.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Convert"
                            disabled={processingId === lead.id}
                            onClick={() => setConverting(lead)}
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
                      {(canUpdate || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && (
                              <DropdownMenuItem onSelect={() => setEditing(lead)}>
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleting(lead)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canCreate && (
        <LeadForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          members={members}
        />
      )}
      {editing && (
        <LeadForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          members={members}
          lead={editing}
        />
      )}
      {converting && (
        <ConvertLeadDialog
          open={!!converting}
          onOpenChange={(o) => !o && setConverting(null)}
          leadId={converting.id}
          companyName={converting.company_name}
          stages={stages}
          canCreateDeal={canCreateDeal}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete lead?"
        description={`This permanently deletes ${deleting?.company_name}.`}
        onConfirm={handleDelete}
      />

      <Dialog open={!!draftLead} onOpenChange={(o) => !o && setDraftLead(null)}>
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
