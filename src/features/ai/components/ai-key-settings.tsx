"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { saveAiApiKey, clearAiApiKey } from "@/features/ai/settings-actions";
import type { AiSettingsSummary } from "@/features/ai/settings-queries";
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
  settings: AiSettingsSummary | null;
  hasEnvFallback: boolean;
}

export function AiKeySettings({ settings, hasEnvFallback }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveAiApiKey({ apiKey });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("AI API key saved");
      setApiKey("");
      router.refresh();
    });
  }

  function clear() {
    startTransition(async () => {
      const result = await clearAiApiKey();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("AI API key removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        Set your own Groq API key for this workspace — get one free at{" "}
        <a
          href="https://console.groq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          console.groq.com
        </a>
        . {hasEnvFallback
          ? "The server's default key is used until you set one."
          : "AI features are disabled until a key is set."}
      </div>

      {settings && (
        <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" />
              Ending in {settings.keyPreview}
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
                <AlertDialogTitle>Remove this AI API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  {hasEnvFallback
                    ? "AI features will fall back to the server's default key."
                    : "AI features will stop working for this workspace until a new key is set."}
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

      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="ai-api-key">{settings ? "Swap key" : "API key"}</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_..."
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
