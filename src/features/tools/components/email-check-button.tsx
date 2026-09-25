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

/**
 * Ghost "Check email" button; the result shows as a badge beside it. The
 * result is tied to the address it was checked for, so editing the email
 * clears it, and the button stays available to re-check (e.g. after an
 * "unknown" DNS timeout).
 */
export function EmailCheckButton({ email }: { email: string | null }) {
  const [checked, setChecked] = useState<{
    email: string;
    result: EmailDomainResult;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!email) return null;
  const target = email;
  const result = checked?.email === target ? checked.result : null;

  function check() {
    startTransition(async () => {
      setChecked({ email: target, result: await checkEmailDomainAction(target) });
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {result && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={BADGE_VARIANT[result.status]}>
              {result.status === "ok" ? "Accepts email" : result.status === "unknown" ? "Unknown" : "No mail"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{result.message}</TooltipContent>
        </Tooltip>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={check} disabled={pending}>
        <MailCheck className="size-4" />
        {pending ? "Checking…" : result ? "Re-check" : "Check email"}
      </Button>
    </span>
  );
}
