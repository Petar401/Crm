"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { TaxRate } from "@/lib/db/types";
import {
  taxRateSchema,
  type TaxRateInput,
} from "@/features/products/schemas";
import {
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "@/features/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  taxRates: TaxRate[];
  canWrite: boolean;
  canDelete: boolean;
}

export function TaxRatesEditor({ taxRates, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [deleting, setDeleting] = useState<TaxRate | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    const r = await deleteTaxRate(deleting.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Tax rate removed");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tax rates</CardTitle>
          <CardDescription>
            VAT, sales tax and any zero-rated exemptions.
          </CardDescription>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New rate
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {taxRates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tax rates yet. Add one to apply it to products and lines.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.name}
                      {r.is_default && <Badge>Default</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {(r.rate_bps / 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.region ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(r)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {canWrite && (
        <TaxRateForm open={open} onOpenChange={setOpen} />
      )}
      {editing && (
        <TaxRateForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          taxRate={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove tax rate?"
        description={`Products currently using ${deleting?.name ?? ""} will keep the rate on any existing lines but will need a new default.`}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

function TaxRateForm({
  open,
  onOpenChange,
  taxRate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taxRate?: TaxRate;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!taxRate;

  const form = useForm<TaxRateInput>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: {
      name: taxRate?.name ?? "",
      rate_bps: String(taxRate?.rate_bps ?? 2000),
      region: taxRate?.region ?? "",
      is_default: taxRate?.is_default ?? false,
    },
  });

  function onSubmit(values: TaxRateInput) {
    startTransition(async () => {
      const r = isEdit
        ? await updateTaxRate(taxRate!.id, values)
        : await createTaxRate(values);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Tax rate updated" : "Tax rate added");
      onOpenChange(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit tax rate" : "New tax rate"}</SheetTitle>
          <SheetDescription>
            Rate is entered in basis points — 2000 = 20%.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="UK VAT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="rate_bps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (basis points)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="GB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Default rate</FormLabel>
                    <p className="text-muted-foreground text-xs">
                      Applied automatically to new products.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Add rate"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
