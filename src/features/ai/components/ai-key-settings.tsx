"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { saveAiApiKey, clearAiApiKey } from "@/features/ai/settings-actions";
import type { AiSettingsSummary } from "@/features/ai/settings-queries";
import type { OpenRouterModelOption } from "@/features/ai/openrouter-models";
import { AI_PROVIDERS, type AiProvider } from "@/features/ai/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  settings: AiSettingsSummary | null;
  hasEnvFallback: boolean;
  openRouterModels: OpenRouterModelOption[];
}

export function AiKeySettings({
  settings,
  hasEnvFallback,
  openRouterModels,
}: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<AiProvider>(
    settings?.provider ?? "groq"
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings?.model ?? "");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveAiApiKey({ provider, apiKey, model });
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

  const config = AI_PROVIDERS[provider];

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        Set your own AI API key for this workspace — get one free at{" "}
        <a
          href={config.consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {new URL(config.consoleUrl).hostname}
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
              {AI_PROVIDERS[settings.provider].label} — ending in{" "}
              {settings.keyPreview}
            </div>
            <div className="text-muted-foreground text-xs">
              {settings.model ? `${settings.model} · ` : ""}
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

      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-2">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as AiProvider)}
            >
              <SelectTrigger id="ai-provider" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="ai-api-key">{settings ? "Swap key" : "API key"}</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.keyPlaceholder}
              autoComplete="off"
            />
          </div>
        </div>

        {provider === "openrouter" && (
          <div className="space-y-2">
            <Label htmlFor="ai-model">Model</Label>
            <Input
              id="ai-model"
              list="openrouter-free-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Search free models, e.g. nvidia/nemotron..."
              autoComplete="off"
            />
            <datalist id="openrouter-free-models">
              {openRouterModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">
              {openRouterModels.length > 0
                ? `${openRouterModels.length} free models available.`
                : "Enter any OpenRouter model id."}
            </p>
          </div>
        )}

        <Button
          type="submit"
          disabled={
            pending ||
            !apiKey.trim() ||
            (provider === "openrouter" && !model.trim())
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
