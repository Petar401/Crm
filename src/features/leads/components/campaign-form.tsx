"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { campaignSchema, type CampaignInput } from "@/features/leads/schemas";
import { createCampaign, updateCampaign } from "@/features/leads/actions";
import type { LeadCampaign } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
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

interface CampaignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: LeadCampaign;
}

export function CampaignForm({
  open,
  onOpenChange,
  campaign,
}: CampaignFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!campaign;

  const form = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      business_description: campaign?.business_description ?? "",
      target_categories: campaign?.target_categories?.join(", ") ?? "",
      location: campaign?.location ?? "",
      country: campaign?.country ?? "",
      frequency: campaign?.frequency ?? "manual",
      auto_create: campaign?.auto_create ?? false,
      max_results: campaign ? String(campaign.max_results) : "25",
      run_hour: campaign ? String(campaign.run_hour) : "9",
      min_score: campaign ? String(campaign.min_score) : "0",
    },
  });

  const frequency = form.watch("frequency");

  function onSubmit(values: CampaignInput) {
    startTransition(async () => {
      const result = isEdit
        ? await updateCampaign(campaign!.id, values)
        : await createCampaign(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Campaign updated" : "Campaign created");
      onOpenChange(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit campaign" : "New lead campaign"}</SheetTitle>
          <SheetDescription>
            Describe who you want to reach. The automation finds matching
            businesses from OpenStreetMap and scores them against your business.
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
                  <FormLabel>Campaign name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dentists in Berlin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="business_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What does your business do?</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="We sell appointment-booking software for small clinics…"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Used by the AI to judge how well each lead fits.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target categories</FormLabel>
                  <FormControl>
                    <Input placeholder="dentist, clinic, doctor" {...field} />
                  </FormControl>
                  <FormDescription>
                    Comma-separated business types to search for.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Berlin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Germany" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual only</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_results"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max per run</FormLabel>
                    <FormControl>
                      <Input placeholder="25" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {frequency !== "manual" && (
                <FormField
                  control={form.control}
                  name="run_hour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Run hour (UTC)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "9"}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>When daily/weekly runs fire.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="min_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum score</FormLabel>
                    <FormControl>
                      <Input placeholder="0" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormDescription>Skip leads below this (0–100).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="auto_create"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel>Auto-create companies</FormLabel>
                    <FormDescription>
                      On: create Company + Contact records directly. Off: queue
                      leads for review first.
                    </FormDescription>
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
                {pending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create campaign"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
