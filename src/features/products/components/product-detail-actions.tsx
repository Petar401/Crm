"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Product, TaxRate } from "@/lib/db/types";
import { archiveProduct, deleteProduct } from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  product: Product;
  taxRates: TaxRate[];
  canUpdate: boolean;
  canDelete: boolean;
}

export function ProductDetailActions({
  product,
  taxRates,
  canUpdate,
  canDelete,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const r = await deleteProduct(product.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Product deleted");
      router.push("/products");
    }
  }

  async function toggleArchive() {
    const r = await archiveProduct(product.id, !product.is_archived);
    if (r.error) toast.error(r.error);
    else {
      toast.success(product.is_archived ? "Restored" : "Archived");
      router.refresh();
    }
  }

  return (
    <div className="flex gap-2">
      {canUpdate && (
        <>
          <Button variant="outline" onClick={toggleArchive}>
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
          </Button>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </>
      )}
      {canDelete && (
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}

      {canUpdate && (
        <ProductForm
          open={editOpen}
          onOpenChange={setEditOpen}
          product={product}
          taxRates={taxRates}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete product?"
        description={`This permanently deletes ${product.name}.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
