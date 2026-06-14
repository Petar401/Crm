import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";

export function WinRate({
  winRate,
  wonCount,
  lostCount,
  weightedPipeline,
}: {
  winRate: number; // 0..1
  wonCount: number;
  lostCount: number;
  weightedPipeline: number;
}) {
  const hasClosed = wonCount + lostCount > 0;
  const pct = Math.round(winRate * 100);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Win rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {/* CSS conic-gradient donut — no chart dependency. */}
        <div
          className="grid size-32 place-items-center rounded-full"
          style={{
            background: hasClosed
              ? `conic-gradient(var(--chart-2) ${pct * 3.6}deg, var(--muted) 0)`
              : "var(--muted)",
          }}
        >
          <div className="bg-card grid size-24 place-items-center rounded-full">
            <span className="text-2xl font-semibold">
              {hasClosed ? `${pct}%` : "—"}
            </span>
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-8 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Won</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              {wonCount}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Lost</p>
            <p className="font-semibold text-red-600 dark:text-red-400">
              {lostCount}
            </p>
          </div>
        </div>

        <div className="w-full border-t pt-3 text-center">
          <p className="text-muted-foreground text-xs">Weighted forecast</p>
          <p className="mt-0.5 text-lg font-semibold">
            {formatCurrency(weightedPipeline)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
