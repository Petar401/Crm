"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { toast } from "sonner";

import { enrichLead } from "@/features/apollo/enrich-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  leadId: string;
  variant?: "icon" | "full";
}

export function EnrichButton({ leadId, variant = "icon" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await enrichLead(leadId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const fields = result.enriched ?? [];
    toast.success(
      fields.length > 0
        ? `Added ${fields.join(", ")} from Apollo`
        : "Apollo had nothing new for this lead"
    );
    router.refresh();
  }

  return (
    <>
      <Button
        variant={variant === "icon" ? "ghost" : "outline"}
        size={variant === "icon" ? "icon" : "sm"}
        title="Enrich with Apollo"
        onClick={() => setOpen(true)}
      >
        <Zap className="size-4" />
        {variant === "full" && "Enrich with Apollo"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Enrich this lead with Apollo?"
        description="This looks up verified email, phone, and job title for this lead and uses one Apollo credit."
        confirmLabel="Enrich"
        onConfirm={handleConfirm}
      />
    </>
  );
}
