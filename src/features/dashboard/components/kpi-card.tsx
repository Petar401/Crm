import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Small coloured delta pill (green up / red down). Renders nothing when there's
 * no comparable baseline (`pct` is null/non-finite). */
export function TrendDelta({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return <span className="text-muted-foreground text-xs font-medium">0%</span>;
  }
  const up = rounded > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(rounded)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  trend,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  trend?: number | null;
}) {
  const card = (
    <Card
      className={cn(
        "h-full",
        href &&
          "transition-colors hover:border-foreground/20 hover:shadow-md"
      )}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold">{value}</p>
            {trend !== undefined && <TrendDelta pct={trend ?? null} />}
          </div>
          {sub && (
            <p className="text-muted-foreground mt-1 truncate text-xs">{sub}</p>
          )}
        </div>
        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
