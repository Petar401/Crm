"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { LeadCampaign } from "@/lib/db/types";
import {
  deleteCampaign,
  runCampaignNow,
} from "@/features/leads/actions";
import { CampaignForm } from "@/features/leads/components/campaign-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignsListProps {
  campaigns: LeadCampaign[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CampaignsList({
  campaigns,
  canCreate,
  canUpdate,
  canDelete,
}: CampaignsListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeadCampaign | null>(null);
  const [deleting, setDeleting] = useState<LeadCampaign | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRun(campaign: LeadCampaign) {
    setRunningId(campaign.id);
    startTransition(async () => {
      const result = await runCampaignNow(campaign.id);
      setRunningId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.count
          ? `Found ${result.count} new lead${result.count === 1 ? "" : "s"}`
          : "No new leads this run"
      );
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteCampaign(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Campaign deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Campaigns</h2>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New campaign
          </Button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No campaigns yet"
          description="Create a campaign to start finding leads automatically."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <CardDescription>
                      {campaign.location ?? "—"} ·{" "}
                      {campaign.target_categories.join(", ") || "any"}
                    </CardDescription>
                  </div>
                  {(canUpdate || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem
                            onSelect={() => setEditing(campaign)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(campaign)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {campaign.frequency}
                    {campaign.frequency !== "manual" &&
                      ` · ${String(campaign.run_hour).padStart(2, "0")}:00 UTC`}
                  </Badge>
                  <Badge variant="outline">
                    {campaign.auto_create ? "Auto-create" : "Review queue"}
                  </Badge>
                  {campaign.min_score > 0 && (
                    <Badge variant="outline">Min score {campaign.min_score}</Badge>
                  )}
                  {campaign.last_run_at && (
                    <span className="text-muted-foreground">
                      Last run:{" "}
                      {new Date(campaign.last_run_at).toLocaleDateString()} (
                      {campaign.last_run_count} found)
                    </span>
                  )}
                </div>
                {canCreate && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningId === campaign.id}
                    onClick={() => handleRun(campaign)}
                  >
                    <Play className="size-4" />
                    {runningId === campaign.id ? "Running…" : "Run now"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canCreate && (
        <CampaignForm open={createOpen} onOpenChange={setCreateOpen} />
      )}
      {editing && (
        <CampaignForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          campaign={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete campaign?"
        description={`This deletes ${deleting?.name} and its queued leads.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
