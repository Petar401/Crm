"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Company, Deal } from "@/lib/db/types";
import { createInvoice } from "@/features/billing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  companies: Pick<Company, "id" | "name">[];
  deals: Pick<Deal, "id" | "name" | "company_id">[];
}

const NONE = "__none";

export function NewInvoiceForm({ companies, deals }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    company_id: "",
    deal_id: "",
    currency: "GBP",
    due_date: "",
    memo: "",
  });

  function save() {
    startTransition(async () => {
      const r = await createInvoice({
        ...state,
        company_id: state.company_id || undefined,
        deal_id: state.deal_id || undefined,
        due_date: state.due_date || undefined,
        memo: state.memo || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Invoice created");
      router.push(`/billing/${r.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice header</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Customer</Label>
            <Select
              value={state.company_id || NONE}
              onValueChange={(v) =>
                setState((s) => ({ ...s, company_id: v === NONE ? "" : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deal</Label>
            <Select
              value={state.deal_id || NONE}
              onValueChange={(v) =>
                setState((s) => ({ ...s, deal_id: v === NONE ? "" : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {deals
                  .filter(
                    (d) => !state.company_id || d.company_id === state.company_id
                  )
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={state.currency}
              onChange={(e) =>
                setState((s) => ({ ...s, currency: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={state.due_date}
              onChange={(e) =>
                setState((s) => ({ ...s, due_date: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            rows={3}
            value={state.memo}
            onChange={(e) => setState((s) => ({ ...s, memo: e.target.value }))}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Add line items on the detail page after the invoice is created, or
          generate this from a signed quote to copy lines automatically.
        </p>
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Create invoice"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
