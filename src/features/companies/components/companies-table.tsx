"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Company } from "@/lib/db/types";
import { deleteCompany } from "@/features/companies/actions";
import { CompanyForm } from "@/features/companies/components/company-form";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataToolbar, useDataView } from "@/components/shared/data-toolbar";
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

interface CompaniesTableProps {
  companies: Company[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CompaniesTable({
  companies,
  canCreate,
  canUpdate,
  canDelete,
}: CompaniesTableProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  // Business types (industries) present in the data drive the type filter.
  const industries = useMemo(
    () =>
      Array.from(
        new Set(
          companies.map((c) => c.industry).filter((v): v is string => !!v)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [companies]
  );

  const dv = useDataView<Company>({
    data: companies,
    searchPlaceholder: "Search companies…",
    searchAccessor: (c) => [c.name, c.industry, c.city, c.email],
    filters: [
      {
        id: "status",
        label: "All statuses",
        accessor: (c) => c.status,
        options: [
          { value: "lead", label: "Lead" },
          { value: "active", label: "Active" },
          { value: "customer", label: "Customer" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      {
        id: "industry",
        label: "All types",
        accessor: (c) => c.industry,
        options: industries.map((i) => ({ value: i, label: i })),
      },
    ],
    sorts: [
      { id: "name", label: "Name", accessor: (c) => c.name, type: "text" },
      {
        id: "created_at",
        label: "Date added",
        accessor: (c) => c.created_at,
        type: "date",
      },
      {
        id: "updated_at",
        label: "Last updated",
        accessor: (c) => c.updated_at,
        type: "date",
      },
      {
        id: "status",
        label: "Status",
        accessor: (c) => c.status,
        type: "text",
      },
      { id: "city", label: "City", accessor: (c) => c.city, type: "text" },
    ],
    defaultSortId: "created_at",
    defaultSortDir: "desc",
  });
  const filtered = dv.view;

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteCompany(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Company deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <DataToolbar controller={dv}>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New company
          </Button>
        )}
      </DataToolbar>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Companies you add will appear here."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New company
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No matches"
          description="No companies match your search and filters."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/companies/${company.id}`)}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.industry ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={company.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.city ?? "—"}
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
                            <DropdownMenuItem onSelect={() => setEditing(company)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleting(company)}
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
        <CompanyForm open={createOpen} onOpenChange={setCreateOpen} />
      )}
      {editing && (
        <CompanyForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          company={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete company?"
        description={`This will permanently delete ${deleting?.name} and its related records.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
