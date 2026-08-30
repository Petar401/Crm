import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  verified: "Verified",
  guessed: "Guessed",
  extrapolated: "Extrapolated",
  unavailable: "Unavailable",
};

const STYLE: Record<string, string> = {
  verified: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  guessed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  extrapolated: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  unavailable: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/** Small badge showing Apollo's email-quality signal (verified/guessed/etc). */
export function EmailStatusBadge({ status }: { status: string | null }) {
  if (!status || !(status in LABEL)) return null;
  return (
    <Badge variant="secondary" className={cn("text-[10px]", STYLE[status])}>
      {LABEL[status]}
    </Badge>
  );
}
