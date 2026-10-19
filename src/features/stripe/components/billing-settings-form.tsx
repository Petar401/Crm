"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { WorkspaceBillingSettings } from "@/lib/db/types";
import { saveBillingSettings } from "@/features/stripe/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  settings: WorkspaceBillingSettings | null;
  webhookUrl: string | null;
}

export function BillingSettingsForm({ settings, webhookUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    stripe_enabled: settings?.stripe_enabled ?? false,
    stripe_publishable_key: settings?.stripe_publishable_key ?? "",
    stripe_secret_key: "",
    webhook_secret: settings?.webhook_secret ?? "",
    auto_invoice_on_won: settings?.auto_invoice_on_won ?? false,
    send_dunning: settings?.send_dunning ?? true,
    dunning_schedule: (settings?.dunning_schedule_days ?? [3, 7, 14]).join(","),
    tax_inclusive: settings?.tax_inclusive ?? false,
    currency: settings?.currency ?? "GBP",
  });

  function save() {
    const dunning_schedule_days = state.dunning_schedule
      .split(",")
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    startTransition(async () => {
      const r = await saveBillingSettings({
        stripe_enabled: state.stripe_enabled,
        stripe_publishable_key: state.stripe_publishable_key,
        stripe_secret_key: state.stripe_secret_key,
        webhook_secret: state.webhook_secret,
        auto_invoice_on_won: state.auto_invoice_on_won,
        send_dunning: state.send_dunning,
        dunning_schedule_days,
        tax_inclusive: state.tax_inclusive,
        currency: state.currency,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Billing settings saved");
      setState((s) => ({ ...s, stripe_secret_key: "" }));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stripe</CardTitle>
          <CardDescription>
            Take payment on quotes and invoices via a Stripe Checkout link.
            Keys go straight into an aes-256-gcm secret box — they never leave
            this server in plaintext once stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Stripe enabled</Label>
              <p className="text-muted-foreground text-xs">
                Off = Pay buttons are hidden and the webhook endpoint 404s.
              </p>
            </div>
            <Switch
              checked={state.stripe_enabled}
              onCheckedChange={(v) =>
                setState((s) => ({ ...s, stripe_enabled: v }))
              }
            />
          </div>
          <div>
            <Label>Publishable key</Label>
            <Input
              value={state.stripe_publishable_key}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  stripe_publishable_key: e.target.value,
                }))
              }
              placeholder="pk_live_…"
            />
          </div>
          <div>
            <Label>Secret key</Label>
            <Input
              type="password"
              value={state.stripe_secret_key}
              onChange={(e) =>
                setState((s) => ({ ...s, stripe_secret_key: e.target.value }))
              }
              placeholder={
                settings?.encrypted_stripe_secret_key
                  ? "Leave blank to keep existing key"
                  : "sk_live_…"
              }
            />
          </div>
          <div>
            <Label>Webhook signing secret</Label>
            <Input
              value={state.webhook_secret}
              onChange={(e) =>
                setState((s) => ({ ...s, webhook_secret: e.target.value }))
              }
              placeholder="whsec_…"
            />
          </div>
          {webhookUrl && (
            <div className="rounded-lg border bg-blue-50 p-3 text-sm">
              <div className="mb-1 font-medium">Your webhook URL</div>
              <code className="break-all">{webhookUrl}</code>
              <p className="text-muted-foreground mt-2 text-xs">
                Register this in Stripe → Developers → Webhooks. Listen for at
                least <code>checkout.session.completed</code>,{" "}
                <code>invoice.paid</code>, <code>invoice.payment_failed</code>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Generate invoice when a deal is won</Label>
              <p className="text-muted-foreground text-xs">
                Copies from the deal (or latest signed quote) to a new draft
                invoice.
              </p>
            </div>
            <Switch
              checked={state.auto_invoice_on_won}
              onCheckedChange={(v) =>
                setState((s) => ({ ...s, auto_invoice_on_won: v }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Send dunning reminders</Label>
              <p className="text-muted-foreground text-xs">
                Notify the invoice owner on each of the days below (after due).
              </p>
            </div>
            <Switch
              checked={state.send_dunning}
              onCheckedChange={(v) =>
                setState((s) => ({ ...s, send_dunning: v }))
              }
            />
          </div>
          <div>
            <Label>Dunning schedule (days overdue)</Label>
            <Input
              value={state.dunning_schedule}
              onChange={(e) =>
                setState((s) => ({ ...s, dunning_schedule: e.target.value }))
              }
              placeholder="3, 7, 14"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Default currency</Label>
              <Input
                value={state.currency}
                onChange={(e) =>
                  setState((s) => ({ ...s, currency: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Prices are tax inclusive</Label>
              <Switch
                checked={state.tax_inclusive}
                onCheckedChange={(v) =>
                  setState((s) => ({ ...s, tax_inclusive: v }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
