"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSignature, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { BillingInvoice } from "@/lib/db/types";
import {
  issueInvoice,
  markUncollectible,
  recordPayment,
  voidInvoice,
} from "@/features/billing/actions";
import {
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/features/billing/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface Props {
  invoice: BillingInvoice;
  canUpdate: boolean;
  canSend: boolean;
  canDelete: boolean;
}

export function InvoiceDetailActions({
  invoice,
  canUpdate,
  canSend,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);

  function issue() {
    startTransition(async () => {
      const r = await issueInvoice(invoice.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Invoice issued");
        router.refresh();
      }
    });
  }

  function voidIt() {
    startTransition(async () => {
      const r = await voidInvoice(invoice.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Voided");
        router.refresh();
      }
    });
  }

  function uncollectible() {
    startTransition(async () => {
      const r = await markUncollectible(invoice.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Marked uncollectible");
        router.refresh();
      }
    });
  }

  const canPay =
    invoice.status === "open" || invoice.status === "draft";

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a
          href={`/api/billing/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          <Download className="size-4" />
          PDF
        </a>
      </Button>
      {canSend && invoice.status === "draft" && (
        <Button variant="outline" onClick={issue} disabled={pending}>
          <FileSignature className="size-4" />
          Issue
        </Button>
      )}
      {canUpdate && canPay && (
        <Button onClick={() => setPayOpen(true)}>
          <Plus className="size-4" />
          Record payment
        </Button>
      )}
      {canUpdate && invoice.status === "open" && (
        <Button variant="outline" onClick={uncollectible} disabled={pending}>
          Mark uncollectible
        </Button>
      )}
      {canDelete && invoice.status !== "void" && invoice.status !== "paid" && (
        <Button variant="destructive" onClick={voidIt} disabled={pending}>
          <XCircle className="size-4" />
          Void
        </Button>
      )}

      <PaymentSheet
        invoice={invoice}
        open={payOpen}
        onOpenChange={setPayOpen}
      />
    </div>
  );
}

function PaymentSheet({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: BillingInvoice;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const balance = Math.max(0, invoice.total_minor - invoice.amount_paid_minor);

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount: (balance / 100).toFixed(2),
      method: "manual",
      external_ref: "",
      paid_at: "",
      note: "",
    },
  });

  function submit(values: RecordPaymentInput) {
    startTransition(async () => {
      const r = await recordPayment(invoice.id, values);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Payment recorded");
      onOpenChange(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Record payment</SheetTitle>
          <SheetDescription>
            Log a payment against invoice {invoice.number}.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submit)}
            className="space-y-3 px-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({invoice.currency})</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <FormControl>
                      <Input placeholder="bank_transfer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paid_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid at</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="external_ref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External reference</FormLabel>
                  <FormControl>
                    <Input placeholder="Stripe / bank ref" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
