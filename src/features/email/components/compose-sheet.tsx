"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { composeEmailSchema, type ComposeEmailInput } from "@/features/email/schemas";
import { sendEmail } from "@/features/email/actions";
import type { ContactEmailOption } from "@/features/email/queries";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactOptions: ContactEmailOption[];
  companyOptions: { id: string; name: string }[];
  replyTo?: { to?: string; subject?: string };
}

const NONE = "__none__";

export function ComposeSheet({
  open,
  onOpenChange,
  contactOptions,
  companyOptions,
  replyTo,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ComposeEmailInput>({
    resolver: zodResolver(composeEmailSchema),
    defaultValues: {
      to: replyTo?.to ?? "",
      cc: "",
      bcc: "",
      subject: replyTo?.subject ?? "",
      body: "",
      contactId: "",
      companyId: "",
      dealId: "",
    },
  });

  function onSubmit(values: ComposeEmailInput) {
    startTransition(async () => {
      const result = await sendEmail(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Email sent");
      onOpenChange(false);
      form.reset();
      router.refresh();
    });
  }

  function pickContact(id: string) {
    if (id === NONE) {
      form.setValue("contactId", "");
      return;
    }
    const contact = contactOptions.find((c) => c.id === id);
    if (!contact) return;
    form.setValue("contactId", contact.id);
    const current = form.getValues("to").trim();
    if (!current) form.setValue("to", contact.email, { shouldValidate: true });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New email</SheetTitle>
          <SheetDescription>
            Send from your connected business mailbox. Sent mail is logged to the
            activity timeline.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            {contactOptions.length > 0 && (
              <FormItem>
                <FormLabel>Link to contact (optional)</FormLabel>
                <Select onValueChange={pickContact} defaultValue={NONE}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No contact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>No contact</SelectItem>
                    {contactOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            {companyOptions.length > 0 && (
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to company (optional)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                      value={field.value || NONE}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No company</SelectItem>
                        {companyOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com, other@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cc</FormLabel>
                    <FormControl>
                      <Input placeholder="optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bcc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bcc</FormLabel>
                    <FormControl>
                      <Input placeholder="optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={10} placeholder="Write your message…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send email"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
