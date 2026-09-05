"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { PriceBook } from "@/lib/db/types";
import {
  priceBookSchema,
  type PriceBookInput,
} from "@/features/products/schemas";
import {
  createPriceBook,
  updatePriceBook,
  deletePriceBook,
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
  priceBooks: PriceBook[];
  canWrite: boolean;
  canDelete: boolean;
}

export function PriceBooksEditor({ priceBooks, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PriceBook | null>(null);
  const [deleting, setDeleting] = useState<PriceBook | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    const r = await deletePriceBook(deleting.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Price book removed");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Price books</CardTitle>
          <CardDescription>
            Named prices per currency or customer tier.
          </CardDescription>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New book
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {priceBooks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No price books yet. Add one for each currency or customer segment
            you sell into.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceBooks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {b.name}
                      {b.is_default && <Badge>Default</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(b)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(b)}
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
        <PriceBookForm open={open} onOpenChange={setOpen} />
      )}
      {editing && (
        <PriceBookForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          priceBook={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove price book?"
        description={`This will remove ${deleting?.name ?? ""} and all price overrides it holds.`}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

function PriceBookForm({
  open,
  onOpenChange,
  priceBook,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  priceBook?: PriceBook;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!priceBook;

  const form = useForm<PriceBookInput>({
    resolver: zodResolver(priceBookSchema),
    defaultValues: {
      name: priceBook?.name ?? "",
      currency: priceBook?.currency ?? "GBP",
      is_default: priceBook?.is_default ?? false,
    },
  });

  function onSubmit(values: PriceBookInput) {
    startTransition(async () => {
      const r = isEdit
        ? await updatePriceBook(priceBook!.id, values)
        : await createPriceBook(values);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Price book updated" : "Price book created");
      onOpenChange(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit price book" : "New price book"}
          </SheetTitle>
          <SheetDescription>
            Prices set on this book override each product&apos;s default.
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
                    <Input placeholder="EU pricing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="EUR" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Default book</FormLabel>
                    <p className="text-muted-foreground text-xs">
                      Used when a quote or invoice has no explicit book set.
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
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create book"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
