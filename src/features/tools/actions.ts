"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { can, requirePermission } from "@/lib/auth/permissions";
import { auditLog } from "@/features/audit/log";
import { companySchema, companyStatuses } from "@/features/companies/schemas";
import { contactSchema } from "@/features/contacts/schemas";
import { lookupPostcode, type PostcodeLookup } from "@/features/tools/postcodes";
import {
  checkEmailDomain,
  type EmailDomainResult,
} from "@/features/tools/email-domain";
import {
  IMPORT_MAX_ROWS,
  contactNameParts,
  detectColumns,
  mapRecord,
  matchKey,
  type ImportEntity,
} from "@/features/tools/import-mapping";

// ---------------------------------------------------------------- lookups

/** Postcode → district/county/region/lat-lng via postcodes.io (no key). */
export async function lookupPostcodeAction(
  postcode: string
): Promise<PostcodeLookup> {
  await requireAuthContext();
  if (typeof postcode !== "string" || postcode.length > 16) {
    return { status: "invalid" };
  }
  return lookupPostcode(postcode);
}

/** Whether an email's domain can receive mail (DNS MX check, no API). */
export async function checkEmailDomainAction(
  email: string
): Promise<EmailDomainResult> {
  await requireAuthContext();
  // An over-long or non-string value is reported as invalid without DNS.
  const value = typeof email === "string" && email.length <= 320 ? email : "";
  return checkEmailDomain(value);
}

// ----------------------------------------------------------------- import

export interface ImportResult {
  error?: string;
  created: number;
  /** Contacts only: companies created for rows naming one that didn't exist. */
  companiesCreated?: number;
  skipped: number;
  /** Row numbers match the spreadsheet (row 1 is the header). */
  errors: { row: number; message: string }[];
}

const recordsSchema = z
  .array(z.record(z.string(), z.string()))
  .max(IMPORT_MAX_ROWS, `Import at most ${IMPORT_MAX_ROWS} rows at a time.`);

const MAX_REPORTED_ERRORS = 50;
const INSERT_BATCH = 200;
/** Upper bound on existing rows read for duplicate detection. */
const MAX_SCAN = 100_000;

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads the given columns of every row in a workspace table, in a stable
 * order. Advances by the rows actually returned, so it's correct whatever
 * the PostgREST max-rows setting is (an unordered or fixed-stride scan can
 * skip or repeat rows, which would let duplicates through).
 */
async function scanWorkspace<T>(
  supabase: Client,
  table: "companies" | "contacts",
  columns: string,
  workspaceId: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_SCAN; ) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("workspace_id", workspaceId)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    if (page.length === 0) break;
    out.push(...page);
    from += page.length;
  }
  return out;
}

async function insertBatches(
  supabase: Client,
  table: "companies" | "contacts",
  rows: Record<string, unknown>[]
): Promise<{ inserted: number; error?: string }> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) return { inserted, error: error.message };
    inserted += batch.length;
  }
  return { inserted };
}

/** Duplicate key for a contact: its email, or else name + company. */
function contactKey(
  email: string | null | undefined,
  first: string,
  last: string,
  companyKey: string
): string {
  const e = matchKey(email);
  return e ? `e:${e}` : `n:${matchKey(first)}|${matchKey(last)}|${companyKey}`;
}

const contactRowSchema = contactSchema.omit({ company_id: true });

/**
 * Imports companies or contacts from parsed CSV records. Every row is
 * re-mapped and validated with the same Zod schema as the create forms.
 * Duplicates (a company name, or a contact's email — or name + company when
 * there's no email — already in the workspace or earlier in the file) are
 * skipped, not updated. Missing companies are only created for contact rows
 * that passed validation and aren't duplicates.
 */
export async function importRecords(
  entity: ImportEntity,
  records: unknown,
  opts: { createMissingCompanies?: boolean } = {}
): Promise<ImportResult> {
  const empty: ImportResult = { created: 0, skipped: 0, errors: [] };
  if (entity !== "companies" && entity !== "contacts") {
    return { ...empty, error: "Unknown import type." };
  }
  const parsed = recordsSchema.safeParse(records);
  if (!parsed.success) {
    return { ...empty, error: parsed.error.issues[0]?.message ?? "Invalid file" };
  }
  if (parsed.data.length === 0) {
    return { ...empty, error: "The file has no data rows." };
  }

  const ctx = await requireAuthContext();
  await requirePermission(entity === "companies" ? "companies.create" : "contacts.create");

  const supabase = await createClient();
  const headers = Object.keys(parsed.data[0] ?? {});
  const mapping = detectColumns(entity, headers);
  const errors: ImportResult["errors"] = [];
  const addError = (row: number, message: string) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message });
  };

  const base = {
    workspace_id: ctx.workspace.id,
    owner_user_id: ctx.userId,
    created_by: ctx.userId,
  };
  let skipped = 0;

  try {
    const companyRows = await scanWorkspace<{ id: string; name: string | null }>(
      supabase,
      "companies",
      "id, name",
      ctx.workspace.id
    );
    const companyIdByKey = new Map<string, string>();
    for (const c of companyRows) {
      const key = matchKey(c.name);
      if (key && !companyIdByKey.has(key)) companyIdByKey.set(key, c.id);
    }

    if (entity === "companies") {
      if (!mapping.name) {
        return { ...empty, error: "No company name column found (e.g. \"Name\" or \"Company\")." };
      }
      const seen = new Set(companyIdByKey.keys());
      const rows: Record<string, unknown>[] = [];
      parsed.data.forEach((record, i) => {
        const fields = mapRecord(record, mapping);
        const status = matchKey(fields.status);
        const result = companySchema.safeParse({
          ...fields,
          status: (companyStatuses as readonly string[]).includes(status) ? status : "lead",
        });
        if (!result.success) {
          return addError(i + 2, result.error.issues[0]?.message ?? "Invalid row");
        }
        const key = matchKey(result.data.name);
        if (seen.has(key)) {
          skipped++;
          return;
        }
        seen.add(key);
        rows.push({ ...result.data, ...base });
      });
      const { inserted, error } = await insertBatches(supabase, "companies", rows);
      if (inserted > 0) await finish(ctx.workspace.id, ctx.userId, entity, { count: inserted });
      return { created: inserted, skipped, errors, ...(error ? { error } : {}) };
    }

    // Contacts: every contact belongs to a company, matched by name.
    if (!mapping.company) {
      return { ...empty, error: "No company column found — every contact needs a company." };
    }
    const companyKeyById = new Map(
      companyRows.map((c) => [c.id, matchKey(c.name)] as const)
    );
    const existingContacts = await scanWorkspace<{
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      company_id: string | null;
    }>(supabase, "contacts", "email, first_name, last_name, company_id", ctx.workspace.id);
    const seen = new Set(
      existingContacts.map((c) =>
        contactKey(
          c.email,
          c.first_name ?? "",
          c.last_name ?? "",
          companyKeyById.get(c.company_id ?? "") ?? ""
        )
      )
    );
    const mayCreateCompanies =
      Boolean(opts.createMissingCompanies) && (await can("companies.create"));

    // Pass 1: validate and de-duplicate, before anything is written.
    const pending: {
      row: number;
      companyName: string;
      companyKey: string;
      data: z.infer<typeof contactRowSchema>;
    }[] = [];
    parsed.data.forEach((record, i) => {
      const fields = mapRecord(record, mapping);
      const companyKey = matchKey(fields.company);
      if (!companyKey) return addError(i + 2, "Company is required.");
      if (!companyIdByKey.has(companyKey) && !mayCreateCompanies) {
        return addError(i + 2, `Company "${fields.company}" doesn't exist.`);
      }
      const { first, last } = contactNameParts(fields);
      const result = contactRowSchema.safeParse({
        first_name: first,
        last_name: last,
        email: fields.email ?? "",
        phone: fields.phone,
        job_title: fields.job_title,
        linkedin_url: fields.linkedin_url,
        contact_role: "other",
        is_primary: false,
      });
      if (!result.success) {
        return addError(i + 2, result.error.issues[0]?.message ?? "Invalid row");
      }
      const key = contactKey(result.data.email, first, last, companyKey);
      if (seen.has(key)) {
        skipped++;
        return;
      }
      seen.add(key);
      pending.push({ row: i + 2, companyName: fields.company!, companyKey, data: result.data });
    });

    // Pass 2: create the missing companies the surviving rows need, in one go.
    let companiesCreated = 0;
    const missing = new Map<string, string>();
    for (const p of pending) {
      if (!companyIdByKey.has(p.companyKey)) missing.set(p.companyKey, p.companyName);
    }
    if (missing.size > 0) {
      const { data, error } = await supabase
        .from("companies")
        .insert(
          Array.from(missing.values()).map((name) => ({ name, status: "lead", ...base }))
        )
        .select("id, name");
      if (error) {
        return { ...empty, skipped, errors, error: `Could not create companies: ${error.message}` };
      }
      for (const c of (data ?? []) as { id: string; name: string }[]) {
        companyIdByKey.set(matchKey(c.name), c.id);
      }
      companiesCreated = data?.length ?? 0;
    }

    // Pass 3: insert the contacts.
    const rows: Record<string, unknown>[] = [];
    for (const p of pending) {
      const companyId = companyIdByKey.get(p.companyKey);
      if (!companyId) {
        addError(p.row, `Company "${p.companyName}" doesn't exist.`);
        continue;
      }
      rows.push({ ...p.data, company_id: companyId, ...base });
    }
    const { inserted, error } = await insertBatches(supabase, "contacts", rows);
    if (inserted > 0 || companiesCreated > 0) {
      await finish(ctx.workspace.id, ctx.userId, entity, {
        count: inserted,
        companiesCreated,
      });
    }
    return {
      created: inserted,
      companiesCreated,
      skipped,
      errors,
      ...(error ? { error } : {}),
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Import failed." };
  }
}

async function finish(
  workspaceId: string,
  userId: string,
  entity: ImportEntity,
  after: { count: number; companiesCreated?: number }
): Promise<void> {
  await auditLog({
    workspaceId,
    actorUserId: userId,
    action: "records.imported",
    entityType: entity,
    after,
  });
  revalidatePath(`/${entity}`);
  if (entity === "contacts") revalidatePath("/companies");
}
