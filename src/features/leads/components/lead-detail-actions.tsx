"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import type { DealStage, Lead } from "@/lib/db/types";
import type { MemberOption } from "@/features/team/queries";
import { deleteLead } from "@/features/leads/actions";
import { LeadForm } from "@/features/leads/components/lead-form";
import { ConvertLeadDialog } from "@/features/leads/components/convert-lead-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  lead: Lead;
  members: MemberOption[];
  stages: DealStage[];
  canUpdate: boolean;
  canDelete: boolean;
  canCreateDeal: boolean;
}

export function LeadDetailActions({
  lead,
  members,
  stages,
  canUpdate,
  canDelete,
  canCreateDeal,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const result = await deleteLead(lead.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Lead deleted");
      router.push("/leads");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate && lead.status === "pending" && (
        <Button size="sm" onClick={() => setConverting(true)}>
          <ArrowRightLeft className="size-4" />
          Convert
        </Button>
      )}
      {canUpdate && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          Edit
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDeleting(true)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}

      <LeadForm
        open={editing}
        onOpenChange={setEditing}
        members={members}
        lead={lead}
      />
      <ConvertLeadDialog
        open={converting}
        onOpenChange={setConverting}
        leadId={lead.id}
        companyName={lead.company_name}
        stages={stages}
        canCreateDeal={canCreateDeal}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete lead?"
        description={`This permanently deletes ${lead.company_name}.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
