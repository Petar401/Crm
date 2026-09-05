"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  productSchema,
  productKinds,
  recurringIntervals,
  type ProductInput,
} from "@/features/products/schemas";
import { createProduct, updateProduct } from "@/features/products/actions";
import type { Product, TaxRate } from "@/lib/db/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  taxRates: TaxRate[];
}

const NONE = "__none";

export function ProductForm({
  open,
  onOpenChange,
  product,
  taxRates,
}: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!product;

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      kind: product?.kind ?? "one_time",
      recurring_interval: product?.recurring_interval ?? "",
      unit: product?.unit ?? "unit",
      default_currency: product?.default_currency ?? "GBP",
      default_price: product?.default_price?.toFixed(2) ?? "0.00",
      default_tax_rate_id: product?.default_tax_rate_id ?? "",
      is_archived: product?.is_archived ?? false,
    },
  });

  const kind = form.watch("kind");

  function onSubmit(values: ProductInput) {
    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product!.id, values)
        : await createProduct(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      onOpenChange(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this catalog item."
              : "Add a product to your catalog."}
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
                    <Input placeholder="Consulting hour" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="CON-HR" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="hour" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productKinds.map((k) => (
                          <SelectItem key={k} value={k}>
                            {k === "one_time" ? "One-time" : "Recurring"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {kind === "recurring" && (
                <FormField
                  control={form.control}
                  name="recurring_interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interval</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {recurringIntervals.map((i) => (
                            <SelectItem key={i} value={i} className="capitalize">
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="default_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default price</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="99.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input placeholder="GBP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {taxRates.length > 0 && (
              <FormField
                control={form.control}
                name="default_tax_rate_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default tax rate</FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? "" : v)
                      }
                      value={field.value || NONE}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No tax</SelectItem>
                        {taxRates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({(t.rate_bps / 100).toFixed(2)}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
