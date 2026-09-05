"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { Product, TaxRate } from "@/lib/db/types";
import {
  archiveProduct,
  deleteProduct,
} from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { formatCurrencyPrecise } from "@/lib/utils/format";
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

interface ProductsTableProps {
  products: Product[];
  taxRates: TaxRate[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const ALL = "all";

export function ProductsTable({
  products,
  taxRates,
  canCreate,
  canUpdate,
  canDelete,
}: ProductsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const taxRateName = useMemo(
    () => new Map(taxRates.map((r) => [r.id, r.name])),
    [taxRates]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (term) {
        const hay = `${p.name} ${p.sku ?? ""} ${p.description ?? ""}`
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (kindFilter !== ALL && p.kind !== kindFilter) return false;
      return true;
    });
  }, [products, search, kindFilter, showArchived]);

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteProduct(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Product deleted");
      router.refresh();
    }
  }

  async function toggleArchive(product: Product) {
    const result = await archiveProduct(product.id, !product.is_archived);
    if (result.error) toast.error(result.error);
    else {
      toast.success(product.is_archived ? "Product restored" : "Product archived");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived((s) => !s)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New product
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={products.length === 0 ? "No products yet" : "No matches"}
          description={
            products.length === 0
              ? "Add your first catalog item so you can quote and invoice."
              : "Try adjusting your search or filters."
          }
          action={
            canCreate && products.length === 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/products/${product.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {product.name}
                      {product.is_archived && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-muted-foreground line-clamp-1 text-xs">
                        {product.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {product.sku ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.kind === "recurring"
                      ? `Every ${product.recurring_interval ?? "?"}`
                      : "One-time"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.default_tax_rate_id
                      ? taxRateName.get(product.default_tax_rate_id) ?? "—"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(
                      product.default_price,
                      product.default_currency
                    )}
                    <span className="text-muted-foreground ml-1 text-xs">
                      /{product.unit}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem
                              onSelect={() => setEditing(product)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canUpdate && (
                            <DropdownMenuItem
                              onSelect={() => toggleArchive(product)}
                            >
                              {product.is_archived ? (
                                <>
                                  <ArchiveRestore className="size-4" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <Archive className="size-4" />
                                  Archive
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleting(product)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
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

      {canCreate && (
        <ProductForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          taxRates={taxRates}
        />
      )}
      {editing && (
        <ProductForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          product={editing}
          taxRates={taxRates}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete product?"
        description={`This will permanently delete ${deleting?.name}. Quotes and invoices already referencing it will keep their line items.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
