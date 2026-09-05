"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  onboardingCreateWorkspaceAction,
  onboardingInviteTeamAction,
  onboardingApplyTemplateAction,
  onboardingFinishAction,
} from "@/features/onboarding/actions";
import { TEMPLATES, type TemplateKey } from "@/features/onboarding/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WizardProps {
  hasExistingWorkspace: boolean;
}

const STEP_LABELS = ["Workspace", "Team", "Template", "Done"] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "SEK", "DKK", "NOK", "JPY"];
const LOCALES = ["en-US", "en-GB", "en-AU", "de-DE", "fr-FR", "es-ES", "pt-BR", "ja-JP"];
const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function OnboardingWizard({ hasExistingWorkspace }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  // Step 1 state
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"
  );
  const [currency, setCurrency] = useState("USD");
  const [locale, setLocale] = useState("en-US");

  // Step 2 state
  const [invites, setInvites] = useState<Array<{ email: string; roleName: string }>>([]);

  // Step 3 state
  const [templateKey, setTemplateKey] = useState<TemplateKey>("empty");

  function submitStep(idx: number, run: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await run();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStep(idx + 1);
      if (idx === 3) {
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-xs">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[11px] font-medium",
                i < step
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === step
                    ? "border-primary text-primary"
                    : "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                i === step ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight className="text-muted-foreground size-3.5" />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Set up your workspace</CardTitle>
            <CardDescription>
              A workspace is your team&apos;s private CRM. You can create more later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wname">Company / team name</Label>
              <Input
                id="wname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Co."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wind">Industry (optional)</Label>
              <Input
                id="wind"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Consultancy, Agency, SaaS…"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="wtz">Timezone</Label>
                <select
                  id="wtz"
                  className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
                  {TIMEZONES.map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wcur">Currency</Label>
                <select
                  id="wcur"
                  className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wloc">Locale</Label>
                <select
                  id="wloc"
                  className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  {LOCALES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {hasExistingWorkspace ? (
                <Button variant="ghost" onClick={() => router.push("/")}>
                  Skip — go to CRM
                </Button>
              ) : null}
              <Button
                disabled={pending || name.trim().length < 2}
                onClick={() =>
                  submitStep(0, () =>
                    onboardingCreateWorkspaceAction({
                      name: name.trim(),
                      industry: industry.trim() || undefined,
                      timezone,
                      currency,
                      locale,
                    })
                  )
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Create workspace"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Invite your team</CardTitle>
            <CardDescription>
              Send invitations now, or skip and add them later from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((inv, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="teammate@company.com"
                  value={inv.email}
                  onChange={(e) => {
                    const next = [...invites];
                    next[i] = { ...next[i], email: e.target.value };
                    setInvites(next);
                  }}
                />
                <select
                  className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
                  value={inv.roleName}
                  onChange={(e) => {
                    const next = [...invites];
                    next[i] = { ...next[i], roleName: e.target.value };
                    setInvites(next);
                  }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Sales Rep">Sales Rep</option>
                  <option value="Read-only">Read-only</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setInvites(invites.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setInvites([...invites, { email: "", roleName: "Sales Rep" }])
              }
            >
              <Plus className="size-4" />
              Add teammate
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Skip
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  const rows = invites.filter((r) => r.email.trim());
                  if (rows.length === 0) {
                    setStep(2);
                    return;
                  }
                  submitStep(1, () =>
                    onboardingInviteTeamAction({ invites: rows })
                  );
                }}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Send invitations"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Pick a starting template</CardTitle>
            <CardDescription>
              This seeds pipelines and a few sample records so you&apos;re not staring
              at a blank screen. You can delete everything later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplateKey(t.key)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
                  templateKey === t.key
                    ? "border-primary bg-primary/5"
                    : "hover:border-foreground/30"
                )}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-muted-foreground text-xs">{t.tagline}</span>
              </button>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  submitStep(2, () =>
                    onboardingApplyTemplateAction({ templateKey })
                  )
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Apply template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re ready</CardTitle>
            <CardDescription>
              Import contacts from CSV inside the CRM at any time under Contacts →
              Import. For now, jump in and take a look.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() => submitStep(3, onboardingFinishAction)}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Open the CRM"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
