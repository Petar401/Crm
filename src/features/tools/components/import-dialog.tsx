"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { importRecords, type ImportResult } from "@/features/tools/actions";
import {
  IMPORT_FIELD_LABELS,
  IMPORT_MAX_ROWS,
  detectColumns,
  mapRecord,
  type ImportEntity,
} from "@/features/tools/import-mapping";
import { parseCsvRecords, decodeCsvBytes } from "@/lib/utils/csv";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const ENTITY_LABEL: Record<ImportEntity, string> = {
  companies: "companies",
  contacts: "contacts",
};

interface ImportDialogProps {
  entity: ImportEntity;
  /** Contacts only: whether the importer also holds `companies.create`. */
  canCreateCompanies?: boolean;
}

/**
 * CSV import dialog for companies/contacts. The client only parses the file
 * for a preview — `importRecords` re-parses, re-maps and re-validates every
 * row server-side and never trusts this component's mapping.
 */
export function ImportDialog({ entity, canCreateCompanies = false }: ImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [createMissingCompanies, setCreateMissingCompanies] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const mapping = useMemo(() => detectColumns(entity, headers), [entity, headers]);
  const mappedFields = useMemo(
    () => Object.keys(IMPORT_FIELD_LABELS[entity]).filter((field) => mapping[field]),
    [entity, mapping]
  );
  const preview = useMemo(
    () => records.slice(0, 5).map((record) => mapRecord(record, mapping)),
    [records, mapping]
  );

  function reset() {
    setFileName(null);
    setHeaders([]);
    setRecords([]);
    setFileError(null);
    setCreateMissingCompanies(true);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);

    if (file.size > MAX_FILE_BYTES) {
      setFileName(null);
      setHeaders([]);
      setRecords([]);
      setFileError("That file is larger than 2 MB.");
      return;
    }

    const text = decodeCsvBytes(await file.arrayBuffer());
    const parsed = parseCsvRecords(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRecords(parsed.records);

    if (parsed.records.length === 0) {
      setFileError("That file has no data rows.");
    } else if (parsed.records.length > IMPORT_MAX_ROWS) {
      setFileError(
        `That file has ${parsed.records.length} rows — import at most ${IMPORT_MAX_ROWS} at a time.`
      );
    } else {
      setFileError(null);
    }
  }

  function handleImport() {
    startTransition(async () => {
      const res = await importRecords(entity, records, { createMissingCompanies });
      setResult(res);
      const wroteSomething = res.created > 0 || (res.companiesCreated ?? 0) > 0;
      if (wroteSomething) {
        // Clear the file so the same rows can't be imported twice by a
        // second click; the summary stays visible below.
        setRecords([]);
        setHeaders([]);
        setFileName(null);
        router.refresh();
      }
      if (res.error) {
        toast.error(
          wroteSomething
            ? `Imported ${res.created} before an error: ${res.error}`
            : res.error
        );
        return;
      }
      const extra = res.companiesCreated
        ? `, created ${res.companiesCreated} new compan${res.companiesCreated === 1 ? "y" : "ies"}`
        : "";
      toast.success(
        `Imported ${res.created}${extra}, skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`
      );
    });
  }

  const canImport = records.length > 0 && !fileError && !pending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {ENTITY_LABEL[entity]}</DialogTitle>
          <DialogDescription>
            Upload a CSV file — we&apos;ll match its columns to CRM fields automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="text-sm"
          />

          {fileError && <p className="text-destructive text-sm">{fileError}</p>}

          {fileName && !fileError && records.length > 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {records.length} row{records.length === 1 ? "" : "s"} detected in{" "}
                <span className="text-foreground font-medium">{fileName}</span>.
              </p>

              {mappedFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {mappedFields.map((field) => (
                    <span key={field} className="bg-muted rounded px-2 py-1">
                      {IMPORT_FIELD_LABELS[entity][field]} ← {mapping[field]}
                    </span>
                  ))}
                </div>
              )}

              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mappedFields.map((field) => (
                        <TableHead key={field}>{IMPORT_FIELD_LABELS[entity][field]}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {mappedFields.map((field) => (
                          <TableCell key={field} className="text-muted-foreground">
                            {row[field] ?? "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {entity === "contacts" && canCreateCompanies && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="import-create-companies"
                    checked={createMissingCompanies}
                    onCheckedChange={(checked) => setCreateMissingCompanies(!!checked)}
                  />
                  <Label htmlFor="import-create-companies" className="font-normal">
                    Create companies that don&apos;t exist yet
                  </Label>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              {result.error && <p className="text-destructive">{result.error}</p>}
              <p>
                Imported {result.created}, skipped {result.skipped} duplicate
                {result.skipped === 1 ? "" : "s"}.
              </p>
              {result.errors.length > 0 && (
                <ul className="text-destructive max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-xs">
                  {result.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleImport} disabled={!canImport}>
            {pending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
