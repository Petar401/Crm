"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import {
  searchApolloPeople,
  importApolloLeads,
  type ApolloResultPreview,
} from "@/features/apollo/search-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ApolloSearchPanel() {
  const router = useRouter();
  const [personTitles, setPersonTitles] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationDomain, setOrganizationDomain] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<ApolloResultPreview[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [importing, startImport] = useTransition();

  const selectedCount = selected.size;
  const allChecked = useMemo(
    () => !!results && results.length > 0 && selectedCount === results.length,
    [results, selectedCount]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const result = await searchApolloPeople({
        personTitles,
        organizationName,
        organizationDomain,
        location,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.results ?? []);
      setSelected(new Set());
    });
  }

  function toggleAll() {
    if (!results) return;
    setSelected(allChecked ? new Set() : new Set(results.map((r) => r.id)));
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
      <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="apollo-titles">Job titles</Label>
          <Input
            id="apollo-titles"
            placeholder="e.g. CEO, Owner"
            value={personTitles}
            onChange={(e) => setPersonTitles(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apollo-org-name">Company name</Label>
          <Input
            id="apollo-org-name"
            placeholder="e.g. Acme Ltd"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apollo-domain">Company domain</Label>
          <Input
            id="apollo-domain"
            placeholder="e.g. acme.com"
            value={organizationDomain}
            onChange={(e) => setOrganizationDomain(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apollo-location">Location</Label>
          <Input
            id="apollo-location"
            placeholder="e.g. London, UK"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={searching}>
            <Search className="size-4" />
            {searching ? "Searching…" : "Search Apollo"}
          </Button>
        </div>
      </form>

      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {results.length} result{results.length === 1 ? "" : "s"}
            </span>
            {selectedCount > 0 && (
              <Button onClick={handleImport} disabled={importing} size="sm">
                {importing
                  ? "Importing…"
                  : `Import selected (${selectedCount})`}
              </Button>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results"
              description="Try broadening your search filters."
            />
          ) : (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
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
                        {r.email ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
