"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { InvoiceListItem } from "@/features/billing/queries";
import { deleteInvoice } from "@/features/billing/actions";
import { formatDate, formatMinor } from "@/lib/utils/format";
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
  invoices: InvoiceListItem[];
  canCreate: boolean;
  canDelete: boolean;
}

const ALL = "all";

const statusVariant: Record<
  InvoiceListItem["status"],
  "default" | "secondary" | "destructive"
> = {
  draft: "secondary",
  open: "default",
  paid: "default",
  uncollectible: "destructive",
  void: "destructive",
};

export function InvoicesTable({ invoices, canCreate, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [deleting, setDeleting] = useState<InvoiceListItem | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (term) {
        const hay = `${i.number} ${i.company?.name ?? ""} ${i.deal?.name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== ALL && i.status !== status) return false;
      return true;
    });
  }, [invoices, search, status]);

  async function handleDelete() {
    if (!deleting) return;
    const r = await deleteInvoice(deleting.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Invoice deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="uncollectible">Uncollectible</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/billing/new")}>
            <Plus className="size-4" />
            New invoice
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={invoices.length === 0 ? "No invoices yet" : "No matches"}
          description={
            invoices.length === 0
              ? "Generate an invoice from a signed quote or create one from scratch."
              : "Adjust the filter or search term."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/billing/${i.id}`)}
                >
                  <TableCell className="font-mono font-medium">
                    {i.number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.company?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[i.status]} className="capitalize">
                      {i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(i.due_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(i.total_minor, i.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(
                      Math.max(0, i.total_minor - i.amount_paid_minor),
                      i.currency
                    )}
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
                            onSelect={() => setDeleting(i)}
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
        title="Delete invoice?"
        description={`This permanently deletes ${deleting?.number}. Payments recorded against it will be lost.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
