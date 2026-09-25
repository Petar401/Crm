"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { companySchema, type CompanyInput } from "@/features/companies/schemas";
import { createCompany, updateCompany } from "@/features/companies/actions";
import { lookupPostcodeAction } from "@/features/tools/actions";
import { addressFillFromPostcode } from "@/lib/utils/postcode";
import type { Company } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}

export function CompanyForm({ open, onOpenChange, company }: CompanyFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lookupPending, startLookupTransition] = useTransition();
  const isEdit = !!company;

  const form = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      website: company?.website ?? "",
      industry: company?.industry ?? "",
      phone: company?.phone ?? "",
      email: company?.email ?? "",
      address_line_1: company?.address_line_1 ?? "",
      city: company?.city ?? "",
      postcode: company?.postcode ?? "",
      country: company?.country ?? "",
      status: company?.status ?? "lead",
    },
  });

  function lookupPostcode() {
    const postcode = form.getValues("postcode");
    if (!postcode?.trim()) {
      toast.error("Enter a postcode first.");
      return;
    }
    startLookupTransition(async () => {
      const result = await lookupPostcodeAction(postcode);
      if (result.status === "ok") {
        form.setValue("postcode", result.info.postcode, { shouldDirty: true });
        const fill = addressFillFromPostcode(result.info, {
          city: form.getValues("city"),
          country: form.getValues("country"),
        });
        if (fill.city) form.setValue("city", fill.city, { shouldDirty: true });
        if (fill.country) form.setValue("country", fill.country, { shouldDirty: true });
        toast.success(
          result.info.district
            ? `Postcode found: ${result.info.district}`
            : "Postcode found"
        );
      } else if (result.status === "invalid") {
        toast.error("That doesn't look like a UK postcode.");
      } else if (result.status === "not_found") {
        toast.error("That postcode couldn't be found.");
      } else {
        toast.error("Couldn't look up that postcode right now.");
      }
    });
  }

  function onSubmit(values: CompanyInput) {
    startTransition(async () => {
      const result = isEdit
        ? await updateCompany(company!.id, values)
        : await createCompany(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Company updated" : "Company created");
      onOpenChange(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit company" : "New company"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this company's details."
              : "Add a company to your CRM."}
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
                    <Input placeholder="Acme Ltd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Software" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="hello@acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+44 …" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
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
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address_line_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="1 High Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Norwich" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <div className="flex gap-1.5">
                      <FormControl>
                        <Input placeholder="NR1" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={lookupPending}
                        onClick={lookupPostcode}
                      >
                        {lookupPending ? "…" : "Look up"}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="UK" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create company"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
