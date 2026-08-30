"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { saveApolloApiKey, clearApolloApiKey } from "@/features/apollo/settings-actions";
import type { ApolloSettingsSummary } from "@/features/apollo/settings-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  settings: ApolloSettingsSummary | null;
  encryptionConfigured: boolean;
}

export function ApolloKeySettings({ settings, encryptionConfigured }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveApolloApiKey({ apiKey });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Apollo API key saved");
      setApiKey("");
      router.refresh();
    });
  }

  function clear() {
    startTransition(async () => {
      const result = await clearApolloApiKey();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Apollo API key removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!encryptionConfigured && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Encryption key not configured on the server — Apollo can&apos;t be
            enabled until an administrator sets{" "}
            <code className="font-mono text-xs">AI_KEY_ENCRYPTION_SECRET</code>{" "}
            in the deployment environment.
          </span>
        </div>
      )}
      <div className="text-muted-foreground text-sm">
        Connect your paid{" "}
        <a
          href="https://app.apollo.io/#/settings/integrations/api"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Apollo.io
        </a>{" "}
        API key to search Apollo&apos;s database for new leads and enrich
        existing leads with verified contact details. Apollo features are
        disabled for this workspace until a key is set.
      </div>

      {settings && (
        <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" />
              Apollo API key — ending in {settings.keyPreview}
            </div>
            <div className="text-muted-foreground text-xs">
              Updated {new Date(settings.updatedAt).toLocaleString()}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={pending}>
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this Apollo API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apollo search and enrichment will stop working for this
                  workspace until a new key is set.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clear}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="apollo-api-key">{settings ? "Swap key" : "API key"}</Label>
          <Input
            id="apollo-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Apollo API key"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={pending || !apiKey.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
