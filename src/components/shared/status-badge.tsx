import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  customer:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  inactive:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  won: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  converted:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <Badge
      variant="secondary"
      className={cn("capitalize", STATUS_STYLES[status])}
    >
      {label}
    </Badge>
  );
}
