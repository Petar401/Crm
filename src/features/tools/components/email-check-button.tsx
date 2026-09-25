"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";

import { checkEmailDomainAction } from "@/features/tools/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Derived from the server action's own return type so this client component
// never imports `email-domain.ts` (server-only) directly, even for a type.
type EmailDomainResult = Awaited<ReturnType<typeof checkEmailDomainAction>>;

const BADGE_VARIANT: Record<EmailDomainResult["status"], "default" | "destructive" | "secondary"> = {
  ok: "default",
  no_mail: "destructive",
  invalid: "destructive",
  unknown: "secondary",
};

/** Ghost "Check email" button that shows the result as a small badge. */
export function EmailCheckButton({ email }: { email: string | null }) {
  const [result, setResult] = useState<EmailDomainResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!email) return null;
  const target = email;

  function check() {
    startTransition(async () => {
      setResult(await checkEmailDomainAction(target));
    });
  }

  if (result) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={BADGE_VARIANT[result.status]} title={result.message}>
            {result.message}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{result.message}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={check} disabled={pending}>
      <MailCheck className="size-4" />
      {pending ? "Checking…" : "Check email"}
    </Button>
  );
}
