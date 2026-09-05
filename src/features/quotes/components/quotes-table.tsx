"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { QuoteListItem } from "@/features/quotes/queries";
import { deleteQuote } from "@/features/quotes/actions";
import { formatMinor } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  quotes: QuoteListItem[];
  canCreate: boolean;
  canDelete: boolean;
}

const ALL = "all";

const statusVariant: Record<
  QuoteListItem["status"],
  "default" | "secondary" | "destructive"
> = {
  draft: "secondary",
  sent: "default",
  signed: "default",
  expired: "destructive",
  void: "destructive",
};

export function QuotesTable({ quotes, canCreate, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [deleting, setDeleting] = useState<QuoteListItem | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (term) {
        const hay = `${q.number} ${q.company?.name ?? ""} ${q.deal?.name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== ALL && q.status !== status) return false;
      return true;
    });
  }, [quotes, search, status]);

  async function handleDelete() {
    if (!deleting) return;
    const r = await deleteQuote(deleting.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Quote deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/quotes/new")}>
            <Plus className="size-4" />
            New quote
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={quotes.length === 0 ? "No quotes yet" : "No matches"}
          description={
            quotes.length === 0
              ? "Draft your first quote from a deal or from scratch."
              : "Try a different search or clear the status filter."
          }
          action={
            canCreate && quotes.length === 0 ? (
              <Button onClick={() => router.push("/quotes/new")}>
                <Plus className="size-4" />
                New quote
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/quotes/${q.id}`)}
                >
                  <TableCell className="font-mono font-medium">
                    {q.number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {q.company?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {q.deal?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[q.status]} className="capitalize">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(q.total_minor, q.currency)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canDelete && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(q)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete quote?"
        description={`This permanently deletes ${deleting?.number}.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
