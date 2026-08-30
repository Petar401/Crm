"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { toast } from "sonner";

import {
  searchApolloPeople,
  importApolloLeads,
  type ApolloResultPreview,
} from "@/features/apollo/search-actions";
import { scoreTier, SCORE_TIER_LABEL, SCORE_TIER_STYLE } from "@/features/leads/score";
import { EmailStatusBadge } from "@/components/shared/email-status-badge";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SENIORITIES = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
];

const EMPLOYEE_RANGES = [
  { value: "1,10", label: "1-10" },
  { value: "11,50", label: "11-50" },
  { value: "51,200", label: "51-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1000" },
  { value: "1001,5000", label: "1001-5000" },
  { value: "5001,10000", label: "5001-10000" },
];

const STORAGE_KEY = "apollo-search-filters";

interface Filters {
  personTitles: string[];
  personSeniorities: string[];
  organizationName: string;
  organizationDomains: string[];
  locations: string[];
  keywords: string;
  employeeRanges: string[];
  excludeTitles: string[];
  excludeDomains: string[];
}

const EMPTY_FILTERS: Filters = {
  personTitles: [],
  personSeniorities: [],
  organizationName: "",
  organizationDomains: [],
  locations: [],
  keywords: "",
  employeeRanges: [],
  excludeTitles: [],
  excludeDomains: [],
};

function readStoredFilters(): Filters {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_FILTERS;
    return { ...EMPTY_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) };
  } catch {
    return EMPTY_FILTERS;
  }
}

function ScorePill({ score }: { score: number }) {
  const tier = scoreTier(score);
  if (!tier) return null;
  return (
    <Badge variant="secondary" className={cn(SCORE_TIER_STYLE[tier])}>
      {score} · {SCORE_TIER_LABEL[tier]}
    </Badge>
  );
}

export function ApolloSearchPanel() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [minScore, setMinScore] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);

  const [results, setResults] = useState<ApolloResultPreview[] | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();
  const [importing, startImport] = useTransition();

  // Hydrate saved filters from localStorage after mount — deliberately not a
  // lazy useState initializer, since that would read localStorage during the
  // client's hydration render and mismatch the server-rendered empty state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only store, not derivable without an effect
    setFilters(readStoredFilters());
  }, []);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFilterItem(key: "personSeniorities" | "employeeRanges", value: string) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  const visible = useMemo(() => {
    if (!results) return null;
    const min = Number(minScore);
    if (!minScore || Number.isNaN(min)) return results;
    return results.filter((r) => r.score >= min);
  }, [results, minScore]);

  const selectedCount = selected.size;
  const allChecked = useMemo(
    () => !!visible && visible.length > 0 && visible.every((r) => selected.has(r.id)),
    [visible, selected]
  );

  function payload() {
    return {
      personTitles: filters.personTitles.join(","),
      personSeniorities: filters.personSeniorities.join(","),
      organizationName: filters.organizationName,
      organizationDomains: filters.organizationDomains.join(","),
      locations: filters.locations.join(","),
      keywords: filters.keywords,
      employeeRanges: filters.employeeRanges.join(","),
      excludeTitles: filters.excludeTitles.join(","),
      excludeDomains: filters.excludeDomains.join(","),
    };
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Best-effort persistence only.
    }
    startSearch(async () => {
      const result = await searchApolloPeople(payload(), 1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.results ?? []);
      setTotalEntries(result.totalEntries ?? 0);
      setPage(1);
      setSelected(new Set());
    });
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    startLoadMore(async () => {
      const result = await searchApolloPeople(payload(), nextPage);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults((prev) => {
        const existingIds = new Set((prev ?? []).map((r) => r.id));
        const fresh = (result.results ?? []).filter((r) => !existingIds.has(r.id));
        return [...(prev ?? []), ...fresh];
      });
      setPage(nextPage);
    });
  }

  function toggleAll() {
    if (!visible) return;
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        visible.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      visible.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImport() {
    if (!results || selectedCount === 0) return;
    const selections = results.filter((r) => selected.has(r.id));
    startImport(async () => {
      const result = await importApolloLeads(selections);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Imported ${result.count ?? 0} lead${result.count === 1 ? "" : "s"}`
      );
      router.push("/leads");
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="apollo-titles">Job titles</Label>
            <TagInput
              id="apollo-titles"
              placeholder="e.g. CEO, Owner"
              values={filters.personTitles}
              onChange={(v) => setFilter("personTitles", v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apollo-org-name">Company name</Label>
            <Input
              id="apollo-org-name"
              placeholder="e.g. Acme Ltd"
              value={filters.organizationName}
              onChange={(e) => setFilter("organizationName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apollo-domain">Company domains</Label>
            <TagInput
              id="apollo-domain"
              placeholder="e.g. acme.com"
              values={filters.organizationDomains}
              onChange={(v) => setFilter("organizationDomains", v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apollo-location">Locations</Label>
            <TagInput
              id="apollo-location"
              placeholder="e.g. London, UK"
              values={filters.locations}
              onChange={(v) => setFilter("locations", v)}
            />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMoreFilters((v) => !v)}
          className="text-muted-foreground"
        >
          {moreFilters ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          More filters
        </Button>

        {moreFilters && (
          <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Seniority</Label>
              <div className="flex flex-wrap gap-1.5">
                {SENIORITIES.map((s) => (
                  <Badge
                    key={s.value}
                    variant={filters.personSeniorities.includes(s.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleFilterItem("personSeniorities", s.value)}
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company size</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYEE_RANGES.map((r) => (
                  <Badge
                    key={r.value}
                    variant={filters.employeeRanges.includes(r.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleFilterItem("employeeRanges", r.value)}
                  >
                    {r.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="apollo-keywords">Keywords</Label>
                <Input
                  id="apollo-keywords"
                  placeholder="e.g. plumbing, HVAC"
                  value={filters.keywords}
                  onChange={(e) => setFilter("keywords", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apollo-min-score">Minimum score</Label>
                <Input
                  id="apollo-min-score"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 50"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apollo-exclude-titles">Exclude titles</Label>
                <TagInput
                  id="apollo-exclude-titles"
                  placeholder="e.g. Intern"
                  values={filters.excludeTitles}
                  onChange={(v) => setFilter("excludeTitles", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apollo-exclude-domains">Exclude domains</Label>
                <TagInput
                  id="apollo-exclude-domains"
                  placeholder="e.g. competitor.com"
                  values={filters.excludeDomains}
                  onChange={(v) => setFilter("excludeDomains", v)}
                />
              </div>
            </div>
          </div>
        )}

        <Button type="submit" disabled={searching}>
          <Search className="size-4" />
          {searching ? "Searching…" : "Search Apollo"}
        </Button>
      </form>

      {visible && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Showing {visible.length} of {totalEntries || visible.length} result
              {totalEntries === 1 ? "" : "s"}
            </span>
            {selectedCount > 0 && (
              <Button onClick={handleImport} disabled={importing} size="sm">
                {importing
                  ? "Importing…"
                  : `Import selected (${selectedCount})`}
              </Button>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results"
              description="Try broadening your search filters."
            />
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={() => toggleOne(r.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {r.name}
                            {r.alreadyInCrm && (
                              <Badge variant="outline" className="text-[10px]">
                                In CRM
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.title ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.companyName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {[r.city, r.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            {r.email ?? "—"}
                            <EmailStatusBadge status={r.emailStatus} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.phone ?? "—"}
                        </TableCell>
                        <TableCell>
                          <ScorePill score={r.score} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {results && results.length < totalEntries && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
