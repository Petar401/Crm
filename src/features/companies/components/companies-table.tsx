"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronsUpDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { CompanyListItem } from "@/features/companies/queries";
import type { MemberOption } from "@/features/team/queries";
import { companyStatuses } from "@/features/companies/schemas";
import { deleteCompany } from "@/features/companies/actions";
import { CompanyForm } from "@/features/companies/components/company-form";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
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

interface CompaniesTableProps {
  companies: CompanyListItem[];
  members: MemberOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const ALL = "all";
const UNASSIGNED = "unassigned";

type SortKey =
  | "name"
  | "industry"
  | "status"
  | "city"
  | "contactCount"
  | "openDealsValue";

type SortState = { key: SortKey; dir: "asc" | "desc" };

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="hover:text-foreground -mx-1 flex items-center gap-1 px-1"
      >
        {label}
        <Icon className="size-3.5 opacity-60" />
      </button>
    </TableHead>
  );
}

export function CompaniesTable({
  companies,
  members,
  canCreate,
  canUpdate,
  canDelete,
}: CompaniesTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [industryFilter, setIndustryFilter] = useState(ALL);
  const [countryFilter, setCountryFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyListItem | null>(null);
  const [deleting, setDeleting] = useState<CompanyListItem | null>(null);

  const ownerNameById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name])),
    [members]
  );

  const industries = useMemo(
    () =>
      Array.from(
        new Set(
          companies.map((c) => c.industry?.trim()).filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [companies]
  );

  const countries = useMemo(
    () =>
      Array.from(
        new Set(
          companies.map((c) => c.country?.trim()).filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [companies]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = companies.filter((c) => {
      if (term && !c.name.toLowerCase().includes(term)) return false;
      if (statusFilter !== ALL && c.status !== statusFilter) return false;
      if (industryFilter !== ALL && (c.industry ?? "") !== industryFilter)
        return false;
      if (countryFilter !== ALL && (c.country ?? "") !== countryFilter)
        return false;
      if (ownerFilter !== ALL) {
        if (ownerFilter === UNASSIGNED) {
          if (c.owner_user_id) return false;
        } else if (c.owner_user_id !== ownerFilter) {
          return false;
        }
      }
      return true;
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const { key } = sort;
      if (key === "contactCount" || key === "openDealsValue") {
        return (a[key] - b[key]) * dir;
      }
      const av = (a[key] ?? "").toString().toLowerCase();
      const bv = (b[key] ?? "").toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [
    companies,
    search,
    statusFilter,
    industryFilter,
    countryFilter,
    ownerFilter,
    sort,
  ]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {companyStatuses.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {industries.length > 0 && (
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All industries</SelectItem>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {countries.length > 0 && (
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All countries</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {members.length > 0 && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All owners</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New company
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={companies.length === 0 ? "No companies yet" : "No matches"}
          description={
            companies.length === 0
              ? "Companies you add will appear here."
              : "Try adjusting your search or filters."
          }
          action={
            canCreate && companies.length === 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New company
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                <SortableHead label="Industry" sortKey="industry" sort={sort} onSort={toggleSort} />
                <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                <SortableHead label="City" sortKey="city" sort={sort} onSort={toggleSort} />
                <SortableHead
                  label="Contacts"
                  sortKey="contactCount"
                  sort={sort}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableHead
                  label="Open deals"
                  sortKey="openDealsValue"
                  sort={sort}
                  onSort={toggleSort}
                  className="text-right"
                />
                <TableHead>Owner</TableHead>
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
                  <TableCell className="text-right tabular-nums">
                    {company.contactCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {company.openDealsValue > 0
                      ? formatCurrency(company.openDealsValue)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.owner_user_id
                      ? ownerNameById.get(company.owner_user_id) ?? "—"
                      : "—"}
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
