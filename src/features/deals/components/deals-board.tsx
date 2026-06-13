"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, Table as TableIcon, Briefcase } from "lucide-react";
import { toast } from "sonner";

import type { DealStage } from "@/lib/db/types";
import type { DealWithRelations, ContactOption } from "@/features/deals/queries";
import { moveDealStage } from "@/features/deals/actions";
import { DealForm } from "@/features/deals/components/deal-form";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataToolbar, useDataView } from "@/components/shared/data-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DealsBoardProps {
  deals: DealWithRelations[];
  stages: DealStage[];
  companies: { id: string; name: string }[];
  contacts: ContactOption[];
  canCreate: boolean;
  canUpdate: boolean;
}

export function DealsBoard({
  deals,
  stages,
  companies,
  contacts,
  canCreate,
  canUpdate,
}: DealsBoardProps) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "table">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const dv = useDataView<DealWithRelations>({
    data: deals,
    searchPlaceholder: "Search deals…",
    searchAccessor: (d) => [d.name, d.company?.name, d.source],
    filters: [
      {
        id: "status",
        label: "All statuses",
        accessor: (d) => d.status,
        options: [
          { value: "open", label: "Open" },
          { value: "won", label: "Won" },
          { value: "lost", label: "Lost" },
        ],
      },
      {
        id: "stage",
        label: "All stages",
        accessor: (d) => d.stage_id,
        options: stages.map((s) => ({ value: s.id, label: s.name })),
      },
      {
        id: "company",
        label: "All companies",
        accessor: (d) => d.company_id,
        options: companies.map((c) => ({ value: c.id, label: c.name })),
      },
    ],
    sorts: [
      { id: "name", label: "Name", accessor: (d) => d.name, type: "text" },
      { id: "value", label: "Value", accessor: (d) => d.value, type: "number" },
      {
        id: "expected_close_date",
        label: "Close date",
        accessor: (d) => d.expected_close_date,
        type: "date",
      },
      {
        id: "probability",
        label: "Probability",
        accessor: (d) => d.probability,
        type: "number",
      },
      {
        id: "created_at",
        label: "Date added",
        accessor: (d) => d.created_at,
        type: "date",
      },
    ],
    defaultSortId: "created_at",
    defaultSortDir: "desc",
  });
  const filtered = dv.view;

  async function onDrop(stage: DealStage) {
    if (!dragId) return;
    const deal = deals.find((d) => d.id === dragId);
    setDragId(null);
    if (!deal || deal.stage_id === stage.id) return;
    const result = await moveDealStage(deal.id, stage.id, stage.name);
    if (result.error) toast.error(result.error);
    else router.refresh();
  }

  const header = (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="bg-muted inline-flex rounded-md p-0.5">
        <Button
          size="sm"
          variant={view === "board" ? "secondary" : "ghost"}
          onClick={() => setView("board")}
        >
          <LayoutGrid className="size-4" />
          Board
        </Button>
        <Button
          size="sm"
          variant={view === "table" ? "secondary" : "ghost"}
          onClick={() => setView("table")}
        >
          <TableIcon className="size-4" />
          Table
        </Button>
      </div>
      {canCreate && companies.length > 0 && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New deal
        </Button>
      )}
    </div>
  );

  if (deals.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Briefcase}
          title="No deals yet"
          description={
            companies.length === 0
              ? "Add a company first, then create deals."
              : "Deals you add will appear on the board."
          }
          action={
            canCreate && companies.length > 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New deal
              </Button>
            ) : undefined
          }
        />
        {canCreate && (
          <DealForm
            open={createOpen}
            onOpenChange={setCreateOpen}
            companies={companies}
            contacts={contacts}
            stages={stages}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {header}

      <div className="mb-4">
        <DataToolbar controller={dv} />
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = filtered.filter((d) => d.stage_id === stage.id);
            const total = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);
            return (
              <div
                key={stage.id}
                className="bg-muted/40 w-72 shrink-0 rounded-lg p-2"
                onDragOver={(e) => canUpdate && e.preventDefault()}
                onDrop={() => canUpdate && onDrop(stage)}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: stage.color ?? "#94a3b8" }}
                    />
                    <span className="text-sm font-medium">{stage.name}</span>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable={canUpdate}
                      onDragStart={() => setDragId(deal.id)}
                      onClick={() => router.push(`/deals/${deal.id}`)}
                      className="bg-background cursor-pointer rounded-md border p-3 shadow-sm transition-shadow hover:shadow"
                    >
                      <p className="text-sm font-medium">{deal.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {deal.company?.name ?? "—"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {formatCurrency(deal.value, deal.currency)}
                        </span>
                        {deal.status !== "open" && (
                          <StatusBadge status={deal.status} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deal) => (
                <TableRow
                  key={deal.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/deals/${deal.id}`)}
                >
                  <TableCell className="font-medium">{deal.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {deal.company?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {stages.find((s) => s.id === deal.stage_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(deal.value, deal.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={deal.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canCreate && (
        <DealForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          companies={companies}
          contacts={contacts}
          stages={stages}
        />
      )}
    </div>
  );
}
