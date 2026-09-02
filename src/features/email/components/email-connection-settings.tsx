"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, TriangleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  emailConnectionSchema,
  type EmailConnectionInput,
  PROVIDER_PRESETS,
  type ProviderPresetKey,
} from "@/features/email/schemas";
import {
  saveEmailConnection,
  testEmailConnection,
  clearEmailConnection,
} from "@/features/email/settings-actions";
import type { EmailSettingsSummary } from "@/features/email/settings-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  settings: EmailSettingsSummary | null;
  encryptionConfigured: boolean;
}

export function EmailConnectionSettings({ settings, encryptionConfigured }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testing, startTesting] = useTransition();
  const [preset, setPreset] = useState<ProviderPresetKey>("gmail");

  const form = useForm<EmailConnectionInput>({
    resolver: zodResolver(emailConnectionSchema),
    defaultValues: {
      fromName: settings?.fromName ?? "",
      fromEmail: settings?.fromEmail ?? "",
      smtpHost: settings?.smtpHost ?? PROVIDER_PRESETS.gmail.smtpHost,
      smtpPort: String(settings?.smtpPort ?? PROVIDER_PRESETS.gmail.smtpPort),
      smtpSecure: settings?.smtpSecure ?? PROVIDER_PRESETS.gmail.smtpSecure,
      imapHost: settings?.imapHost ?? PROVIDER_PRESETS.gmail.imapHost,
      imapPort: String(settings?.imapPort ?? PROVIDER_PRESETS.gmail.imapPort),
      imapSecure: settings?.imapSecure ?? PROVIDER_PRESETS.gmail.imapSecure,
      password: "",
    },
  });

  function applyPreset(key: ProviderPresetKey) {
    setPreset(key);
    const p = PROVIDER_PRESETS[key];
    form.setValue("smtpHost", p.smtpHost);
    form.setValue("smtpPort", String(p.smtpPort));
    form.setValue("smtpSecure", p.smtpSecure);
    form.setValue("imapHost", p.imapHost);
    form.setValue("imapPort", String(p.imapPort));
    form.setValue("imapSecure", p.imapSecure);
  }

  function onSubmit(values: EmailConnectionInput) {
    startTransition(async () => {
      const result = await saveEmailConnection(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mailbox connection saved");
      form.setValue("password", "");
      router.refresh();
    });
  }

  function test() {
    startTesting(async () => {
      const result = await testEmailConnection();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Connection verified — SMTP and IMAP both working");
      router.refresh();
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await clearEmailConnection();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mailbox disconnected");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!encryptionConfigured && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Encryption key not configured on the server — a mailbox can&apos;t
            be connected until an administrator sets{" "}
            <code className="font-mono text-xs">AI_KEY_ENCRYPTION_SECRET</code>{" "}
            in the deployment environment.
          </span>
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        Connect a shared business mailbox for the workspace. Mail is sent over
        SMTP and read over IMAP; the password is encrypted before it is stored.
        For Gmail/Google Workspace you must use an{" "}
        <a
          href="https://support.google.com/accounts/answer/185833"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          App Password
        </a>
        , not your normal password.
      </p>

      {settings && (
        <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4" />
              {settings.emailPreview}
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {settings.lastVerifiedAt ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Verified {new Date(settings.lastVerifiedAt).toLocaleString()}
                </>
              ) : (
                "Not yet verified — use Test connection below"
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={test}
              disabled={testing}
            >
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={pending}>
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect this mailbox?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sending and the mailbox view will stop working for this
                    workspace until an email account is connected again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={disconnect}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <div className="max-w-md space-y-1">
        <Label>Provider preset</Label>
        <Select value={preset} onValueChange={(v) => applyPreset(v as ProviderPresetKey)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDER_PRESETS) as ProviderPresetKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PROVIDER_PRESETS[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{PROVIDER_PRESETS[preset].hint}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Sales" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fromEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input placeholder="you@business.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <FormField
              control={form.control}
              name="smtpHost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SMTP host</FormLabel>
                  <FormControl>
                    <Input placeholder="smtp.gmail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="smtpPort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input className="w-20" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="smtpSecure"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <FormLabel>SMTP uses TLS/SSL</FormLabel>
                  <FormDescription className="text-xs">
                    On for port 465, off for 587 (STARTTLS).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <FormField
              control={form.control}
              name="imapHost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IMAP host</FormLabel>
                  <FormControl>
                    <Input placeholder="imap.gmail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imapPort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input className="w-20" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="imapSecure"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <FormLabel>IMAP uses TLS/SSL</FormLabel>
                  <FormDescription className="text-xs">
                    Usually on (port 993).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{settings ? "New password" : "Password / App password"}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      settings ? "Leave blank to keep current password" : "App password"
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={pending || !encryptionConfigured}>
            {pending ? "Saving…" : settings ? "Save changes" : "Connect mailbox"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
