"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import {
  suggestNextStep,
  draftFollowUp,
  companyBrief,
  type AiResult,
} from "@/features/ai/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiPanelProps {
  entityType: "deal" | "company";
  entityId: string;
  aiEnabled: boolean;
}

export function AiPanel({ entityType, entityId, aiEnabled }: AiPanelProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!aiEnabled) return null;

  function run(fn: () => Promise<AiResult>) {
    setResult(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else setResult(r.text ?? "");
    });
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          AI assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {entityType === "deal" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => suggestNextStep(entityId))}
              >
                Suggest next step
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => draftFollowUp(entityId))}
              >
                Draft follow-up
              </Button>
            </>
          )}
          {entityType === "company" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => companyBrief(entityId))}
            >
              Create company brief
            </Button>
          )}
        </div>

        {pending && (
          <p className="text-muted-foreground text-sm">Thinking…</p>
        )}

        {result && (
          <div className="bg-muted/50 relative rounded-md border p-3">
            <p className="text-sm whitespace-pre-wrap">{result}</p>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 size-7"
              onClick={copy}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
