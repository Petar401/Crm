"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { convertLead } from "@/features/leads/actions";
import type { DealStage } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyName: string;
  stages: DealStage[];
  canCreateDeal: boolean;
  onConverted?: () => void;
}

export function ConvertLeadDialog({
  open,
  onOpenChange,
  leadId,
  companyName,
  stages,
  canCreateDeal,
  onConverted,
}: ConvertLeadDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createDeal, setCreateDeal] = useState(false);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("GBP");

  function handleConvert() {
    startTransition(async () => {
      const result = await convertLead(leadId, {
        createDeal: createDeal && canCreateDeal,
        stageId: stageId || null,
        pipelineId: stages.find((s) => s.id === stageId)?.pipeline_id ?? null,
        dealValue: value || null,
        currency,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        createDeal && canCreateDeal
          ? `${companyName} converted to company + deal`
          : `${companyName} added to companies`
      );
      onOpenChange(false);
      onConverted?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert lead</DialogTitle>
          <DialogDescription>
            Create a Company{" "}
            {createDeal && canCreateDeal ? "+ Contact + Deal" : "(and Contact)"}{" "}
            from {companyName}.
          </DialogDescription>
        </DialogHeader>

        {canCreateDeal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5 pr-4">
                <Label>Also create a deal</Label>
                <p className="text-muted-foreground text-xs">
                  Open a deal in your pipeline for this lead.
                </p>
              </div>
              <Switch checked={createDeal} onCheckedChange={setCreateDeal} />
            </div>

            {createDeal && (
              <div className="space-y-4">
                {stages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      type="number"
                      placeholder="10000"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={pending}>
            {pending ? "Converting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
