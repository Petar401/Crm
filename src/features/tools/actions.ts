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
  if (typeof email !== "string" || email.length > 320) {
    return {
      status: "invalid",
      domain: null,
      mx: [],
      message: "This email address or its domain doesn't exist.",
    };
  }
  return checkEmailDomain(email);
}

// ----------------------------------------------------------------- import

export interface ImportResult {
  error?: string;
  created: number;
  skipped: number;
  /** Row numbers match the spreadsheet (row 1 is the header). */
  errors: { row: number; message: string }[];
}

const recordsSchema = z
  .array(z.record(z.string(), z.string()))
  .max(IMPORT_MAX_ROWS, `Import at most ${IMPORT_MAX_ROWS} rows at a time.`);

const MAX_REPORTED_ERRORS = 50;
const INSERT_BATCH = 200;

type Client = Awaited<ReturnType<typeof createClient>>;

/** Existing values of one column in the workspace, as match keys. */
async function existingKeys(
  supabase: Client,
  table: "companies" | "contacts",
  column: "name" | "email",
  workspaceId: string
): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .eq("workspace_id", workspaceId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, string | null>[];
    for (const r of rows) {
      const key = matchKey(r[column]);
      if (key && r.id) keys.set(key, r.id);
    }
    if (rows.length < 1000) break;
  }
  return keys;
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

/**
 * Imports companies or contacts from parsed CSV records. Every row is
 * re-mapped and validated with the same Zod schema as the create forms.
 * Duplicates (company name / contact email already in the workspace or earlier
 * in the file) are skipped, not updated.
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
  const rows: Record<string, unknown>[] = [];

  try {
    if (entity === "companies") {
      if (!mapping.name) {
        return { ...empty, error: "No company name column found (e.g. \"Name\" or \"Company\")." };
      }
      const seen = await existingKeys(supabase, "companies", "name", ctx.workspace.id);
      parsed.data.forEach((record, i) => {
        const fields = mapRecord(record, mapping);
        const status = matchKey(fields.status);
        const candidate = {
          ...fields,
          status: (companyStatuses as readonly string[]).includes(status) ? status : "lead",
        };
        const result = companySchema.safeParse(candidate);
        if (!result.success) {
          return addError(i + 2, result.error.issues[0]?.message ?? "Invalid row");
        }
        const key = matchKey(result.data.name);
        if (seen.has(key)) {
          skipped++;
          return;
        }
        seen.set(key, "");
        rows.push({ ...result.data, ...base });
      });
      const { inserted, error } = await insertBatches(supabase, "companies", rows);
      if (error) return { created: inserted, skipped, errors, error };
      await finish(ctx.workspace.id, ctx.userId, entity, inserted);
      return { created: inserted, skipped, errors };
    }

    // Contacts: every contact belongs to a company, matched by name.
    if (!mapping.company) {
      return { ...empty, error: "No company column found — every contact needs a company." };
    }
    const companies = await existingKeys(supabase, "companies", "name", ctx.workspace.id);
    const emails = await existingKeys(supabase, "contacts", "email", ctx.workspace.id);
    const mayCreateCompanies =
      Boolean(opts.createMissingCompanies) && (await can("companies.create"));

    for (const [i, record] of parsed.data.entries()) {
      const fields = mapRecord(record, mapping);
      const companyKey = matchKey(fields.company);
      if (!companyKey) {
        addError(i + 2, "Company is required.");
        continue;
      }
      let companyId = companies.get(companyKey);
      if (!companyId && mayCreateCompanies) {
        const { data, error } = await supabase
          .from("companies")
          .insert({ name: fields.company, status: "lead", ...base })
          .select("id")
          .single<{ id: string }>();
        if (error || !data) {
          addError(i + 2, `Could not create company "${fields.company}".`);
          continue;
        }
        companyId = data.id;
        companies.set(companyKey, companyId);
      }
      if (!companyId) {
        addError(i + 2, `Company "${fields.company}" doesn't exist.`);
        continue;
      }

      const { first, last } = contactNameParts(fields);
      const result = contactSchema.safeParse({
        company_id: companyId,
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
        addError(i + 2, result.error.issues[0]?.message ?? "Invalid row");
        continue;
      }
      const emailKey = matchKey(result.data.email);
      if (emailKey && emails.has(emailKey)) {
        skipped++;
        continue;
      }
      if (emailKey) emails.set(emailKey, "");
      rows.push({ ...result.data, ...base });
    }

    const { inserted, error } = await insertBatches(supabase, "contacts", rows);
    if (error) return { created: inserted, skipped, errors, error };
    await finish(ctx.workspace.id, ctx.userId, entity, inserted);
    return { created: inserted, skipped, errors };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Import failed." };
  }
}

async function finish(
  workspaceId: string,
  userId: string,
  entity: ImportEntity,
  count: number
): Promise<void> {
  await auditLog({
    workspaceId,
    actorUserId: userId,
    action: "records.imported",
    entityType: entity,
    after: { count },
  });
  revalidatePath(`/${entity}`);
  if (entity === "contacts") revalidatePath("/companies");
}
