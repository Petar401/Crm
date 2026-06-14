import { Briefcase } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import type { DealStage } from "@/lib/db/types";

export function PipelineFunnel({
  data,
  total,
}: {
  data: { stage: DealStage; count: number; value: number }[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasAny = data.some((d) => d.count > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Pipeline by stage</CardTitle>
          <span className="text-muted-foreground text-sm">
            {formatCurrency(total)} open
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <EmptyState
            icon={Briefcase}
            title="No open pipeline"
            description="Deals you create will be grouped by stage here."
          />
        ) : (
          <div className="space-y-4">
            {data.map(({ stage, count, value }) => {
              const color = stage.color ?? "var(--chart-1)";
              const width = `${(value / max) * 100}%`;
              return (
                <div key={stage.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{stage.name}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {formatCurrency(value)}
                    </span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
