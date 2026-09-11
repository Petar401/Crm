"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";

import {
  draftEmailFromPrompt,
  draftEmailReply,
  reviseEmailText,
  type EmailReplyContext,
} from "@/features/ai/actions";
import type { ComposeEmailInput } from "@/features/email/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  form: UseFormReturn<ComposeEmailInput>;
  aiEnabled: boolean;
  mode: "new" | "reply";
  replyContext?: EmailReplyContext;
  quoteBlock: string;
}

const QUICK_REVISIONS = [
  "Fix grammar and spelling",
  "Make more formal",
  "Make shorter",
  "Make more casual",
] as const;

export function AiComposeAssistant({
  form,
  aiEnabled,
  mode,
  replyContext,
  quoteBlock,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [draftInstruction, setDraftInstruction] = useState("");
  const [reviseInstruction, setReviseInstruction] = useState("");

  if (!aiEnabled) return null;

  function runDraft() {
    if (!draftInstruction.trim()) {
      toast.error(
        mode === "reply"
          ? "Describe how you'd like to reply."
          : "Describe what the email should say."
      );
      return;
    }
    startTransition(async () => {
      if (mode === "reply") {
        const result = await draftEmailReply(replyContext ?? {}, draftInstruction);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        form.setValue("body", `${result.text ?? ""}${quoteBlock}`, {
          shouldValidate: true,
        });
      } else {
        const values = form.getValues();
        const result = await draftEmailFromPrompt(draftInstruction, {
          contactId: values.contactId || undefined,
          companyId: values.companyId || undefined,
          dealId: values.dealId || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.subject) {
          form.setValue("subject", result.subject, { shouldValidate: true });
        }
        form.setValue("body", result.text ?? "", { shouldValidate: true });
      }
      setDraftInstruction("");
    });
  }

  function runRevision(instruction: string) {
    const current = form.getValues("body");
    if (!current.trim()) {
      toast.error("Write a draft first.");
      return;
    }
    startTransition(async () => {
      const result = await reviseEmailText(current, instruction);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.setValue("body", result.text ?? current, { shouldValidate: true });
      setReviseInstruction("");
    });
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4" />
          AI assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={
              mode === "reply"
                ? "e.g. accept the meeting, ask for more detail"
                : "e.g. follow up and ask about their budget"
            }
            value={draftInstruction}
            onChange={(e) => setDraftInstruction(e.target.value)}
            disabled={pending}
          />
          <Button type="button" size="sm" disabled={pending} onClick={runDraft}>
            {mode === "reply" ? "Draft reply" : "Generate draft"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_REVISIONS.map((label) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runRevision(label)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Or describe a change, e.g. add a P.S. about the discount"
            value={reviseInstruction}
            onChange={(e) => setReviseInstruction(e.target.value)}
            disabled={pending}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !reviseInstruction.trim()}
            onClick={() => runRevision(reviseInstruction)}
          >
            Revise
          </Button>
        </div>
        {pending && <p className="text-muted-foreground text-xs">Thinking…</p>}
      </CardContent>
    </Card>
  );
}
