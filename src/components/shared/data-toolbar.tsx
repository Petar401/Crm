"use client";

/**
 * Reusable client-side filtering, sorting and search for list/table views.
 *
 * `useDataView` derives the visible rows from the full dataset the page already
 * loaded; `DataToolbar` renders the bound controls. Each section declares its own
 * search fields, filters and sort options, so behaviour stays consistent across
 * Companies, Contacts, Deals, Tasks and Leads without touching the data layer.
 */

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel for the "no filter" option (Radix Select forbids empty values). */
const ALL = "__all__";

export interface FilterDef<T> {
  id: string;
  /** Label shown when nothing is selected, e.g. "All types". */
  label: string;
  options: { value: string; label: string }[];
  accessor: (row: T) => string | null | undefined;
}

export interface SortDef<T> {
  id: string;
  label: string;
  accessor: (row: T) => string | number | null | undefined;
  type?: "text" | "number" | "date";
}

export interface DataViewController<T> {
  view: T[];
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder: string;
  filters: FilterDef<T>[];
  filterValues: Record<string, string>;
  setFilter: (id: string, value: string) => void;
  sorts: SortDef<T>[];
  sortId: string;
  setSortId: (id: string) => void;
  sortDir: "asc" | "desc";
  toggleSortDir: () => void;
}

interface UseDataViewOptions<T> {
  data: T[];
  /** Fields scanned by the search box. */
  searchAccessor?: (row: T) => (string | null | undefined)[];
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  sorts?: SortDef<T>[];
  defaultSortId?: string;
  defaultSortDir?: "asc" | "desc";
}

export function useDataView<T>({
  data,
  searchAccessor,
  searchPlaceholder = "Search…",
  filters = [],
  sorts = [],
  defaultSortId,
  defaultSortDir = "asc",
}: UseDataViewOptions<T>): DataViewController<T> {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortId, setSortId] = useState(defaultSortId ?? sorts[0]?.id ?? "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  function setFilter(id: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [id]: value }));
  }

  const view = useMemo(() => {
    let rows = data;

    const q = search.trim().toLowerCase();
    if (q && searchAccessor) {
      rows = rows.filter((row) =>
        searchAccessor(row).some((v) => (v ?? "").toLowerCase().includes(q))
      );
    }

    for (const filter of filters) {
      const value = filterValues[filter.id];
      if (value && value !== ALL) {
        rows = rows.filter((row) => (filter.accessor(row) ?? "") === value);
      }
    }

    const activeSort = sorts.find((s) => s.id === sortId);
    if (activeSort) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = activeSort.accessor(a);
        const bv = activeSort.accessor(b);
        // Empty values always sort last, regardless of direction.
        const aEmpty = av == null || av === "";
        const bEmpty = bv == null || bv === "";
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        let cmp: number;
        if (activeSort.type === "number") {
          cmp = Number(av) - Number(bv);
        } else if (activeSort.type === "date") {
          cmp =
            new Date(av as string).getTime() - new Date(bv as string).getTime();
        } else {
          cmp = String(av).localeCompare(String(bv), undefined, {
            sensitivity: "base",
            numeric: true,
          });
        }
        return cmp * dir;
      });
    }

    return rows;
  }, [
    data,
    search,
    searchAccessor,
    filters,
    filterValues,
    sorts,
    sortId,
    sortDir,
  ]);

  return {
    view,
    search,
    setSearch,
    searchPlaceholder,
    filters,
    filterValues,
    setFilter,
    sorts,
    sortId,
    setSortId,
    sortDir,
    toggleSortDir: () => setSortDir((d) => (d === "asc" ? "desc" : "asc")),
  };
}

export function DataToolbar<T>({
  controller,
  children,
}: {
  controller: DataViewController<T>;
  children?: ReactNode;
}) {
  const {
    search,
    setSearch,
    searchPlaceholder,
    filters,
    filterValues,
    setFilter,
    sorts,
    sortId,
    setSortId,
    sortDir,
    toggleSortDir,
  } = controller;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {filters.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] ?? ALL}
          onValueChange={(v) => setFilter(filter.id, v)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{filter.label}</SelectItem>
            {filter.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {sorts.length > 0 && (
        <div className="flex items-center gap-1">
          <Select value={sortId} onValueChange={setSortId}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sorts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortDir}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            aria-label="Toggle sort direction"
          >
            {sortDir === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>
      )}

      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}
