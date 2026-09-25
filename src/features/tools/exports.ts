import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "@/lib/constants/permissions";
import { toCsv, type CsvColumn } from "@/lib/utils/csv";
import { buildIcs, type IcsEvent } from "@/lib/utils/ics";
import { buildVCards, type VCardContact } from "@/lib/utils/vcard";

/**
 * Server-side data for the CSV / vCard / iCalendar exports. Reads use the
 * request's RLS-scoped client and always filter by workspace, so an export
 * never contains more than the member could see in the UI.
 */

/** Hard cap per export, read in pages of up to 1,000 rows. */
export const EXPORT_MAX_ROWS = 10_000;
const PAGE_SIZE = 1_000;

export const CSV_ENTITIES = [
  "companies",
  "contacts",
  "deals",
  "leads",
  "tasks",
] as const;
export type CsvEntity = (typeof CSV_ENTITIES)[number];

export const CSV_VIEW_PERMISSION: Record<CsvEntity, PermissionKey> = {
  companies: "companies.view",
  contacts: "contacts.view",
  deals: "deals.view",
  leads: "leads.view",
  tasks: "tasks.view",
};

export function isCsvEntity(value: string): value is CsvEntity {
  return (CSV_ENTITIES as readonly string[]).includes(value);
}

type Row = Record<string, unknown>;
type Named = { name?: string | null; full_name?: string | null } | null;

const SELECT: Record<CsvEntity, string> = {
  companies: "*",
  contacts: "*, company:companies(name)",
  deals:
    "*, company:companies(name), stage:deal_stages(name), pipeline:deal_pipelines(name)",
  leads: "*",
  tasks:
    "*, assignee:profiles!tasks_assigned_to_fkey(full_name), company:companies(name), deal:deals(name)",
};

const name = (value: unknown) => (value as Named)?.name ?? "";
const fullName = (value: unknown) => (value as Named)?.full_name ?? "";
const col = (header: string, key: string): CsvColumn<Row> => ({
  header,
  value: (r) => r[key],
});

const COLUMNS: Record<CsvEntity, CsvColumn<Row>[]> = {
  companies: [
    col("Name", "name"),
    col("Status", "status"),
    col("Industry", "industry"),
    col("Website", "website"),
    col("Email", "email"),
    col("Phone", "phone"),
    col("Address", "address_line_1"),
    col("City", "city"),
    col("Postcode", "postcode"),
    col("Country", "country"),
    col("Created", "created_at"),
    col("ID", "id"),
  ],
  contacts: [
    col("First name", "first_name"),
    col("Last name", "last_name"),
    { header: "Company", value: (r) => name(r.company) },
    col("Email", "email"),
    col("Phone", "phone"),
    col("Job title", "job_title"),
    col("Role", "contact_role"),
    col("Primary", "is_primary"),
    col("LinkedIn", "linkedin_url"),
    col("Created", "created_at"),
    col("ID", "id"),
  ],
  deals: [
    col("Name", "name"),
    { header: "Company", value: (r) => name(r.company) },
    { header: "Pipeline", value: (r) => name(r.pipeline) },
    { header: "Stage", value: (r) => name(r.stage) },
    col("Status", "status"),
    col("Value", "value"),
    col("Currency", "currency"),
    col("Probability", "probability"),
    col("Expected close", "expected_close_date"),
    col("Source", "source"),
    col("Next step", "next_step"),
    col("Created", "created_at"),
    col("ID", "id"),
  ],
  leads: [
    col("Company", "company_name"),
    col("Status", "status"),
    col("Industry", "industry"),
    col("Website", "website"),
    col("Email", "email"),
    col("Phone", "phone"),
    col("Address", "address_line_1"),
    col("City", "city"),
    col("County/State", "state"),
    col("Postcode", "postal_code"),
    col("Country", "country"),
    col("Contact name", "contact_name"),
    col("Contact email", "contact_email"),
    col("Contact phone", "contact_phone"),
    col("Job title", "job_title"),
    col("Match score", "match_score"),
    col("Source", "source"),
    col("Created", "created_at"),
    col("ID", "id"),
  ],
  tasks: [
    col("Title", "title"),
    col("Status", "status"),
    col("Priority", "priority"),
    col("Due", "due_at"),
    { header: "Assignee", value: (r) => fullName(r.assignee) },
    { header: "Company", value: (r) => name(r.company) },
    { header: "Deal", value: (r) => name(r.deal) },
    col("Description", "description"),
    col("Created", "created_at"),
    col("ID", "id"),
  ],
};

/** Simple row filters applied on top of the workspace filter. */
interface RowFilter {
  eq?: Record<string, string>;
  /** Column value must not be any of these (fixed, code-defined values). */
  notIn?: Record<string, string[]>;
  notNull?: string[];
}

/** Reads up to EXPORT_MAX_ROWS rows of a workspace table, page by page. */
async function fetchAll(
  table: string,
  select: string,
  workspaceId: string,
  filter: RowFilter = {}
): Promise<Row[]> {
  const supabase = await createClient();
  const rows: Row[] = [];
  // Advance by the rows actually returned, so this is correct whatever the
  // PostgREST max-rows setting is; stop on an empty page.
  for (let from = 0; from < EXPORT_MAX_ROWS; ) {
    let query = supabase
      .from(table)
      .select(select)
      .eq("workspace_id", workspaceId);
    for (const [key, value] of Object.entries(filter.eq ?? {})) {
      query = query.eq(key, value);
    }
    for (const [key, values] of Object.entries(filter.notIn ?? {})) {
      query = query.not(key, "in", `(${values.join(",")})`);
    }
    for (const key of filter.notNull ?? []) {
      query = query.not(key, "is", null);
    }
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, Math.min(from + PAGE_SIZE, EXPORT_MAX_ROWS) - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Row[];
    if (page.length === 0) break;
    rows.push(...page);
    from += page.length;
  }
  return rows;
}

export async function exportCsv(
  entity: CsvEntity,
  workspaceId: string
): Promise<{ csv: string; count: number }> {
  const rows = await fetchAll(entity, SELECT[entity], workspaceId);
  return { csv: toCsv(rows, COLUMNS[entity]), count: rows.length };
}

/** All contacts, or one, as a .vcf file. Returns null for an unknown id. */
export async function exportVCards(
  workspaceId: string,
  contactId?: string
): Promise<{ vcf: string; count: number } | null> {
  const rows = await fetchAll(
    "contacts",
    "*, company:companies(name)",
    workspaceId,
    contactId ? { eq: { id: contactId } } : {}
  );
  if (contactId && rows.length === 0) return null;
  const cards: VCardContact[] = rows.map((r) => ({
    uid: `${r.id}@crm-contact`,
    firstName: String(r.first_name ?? ""),
    lastName: (r.last_name as string | null) ?? null,
    organization: name(r.company) || null,
    title: (r.job_title as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
  }));
  return { vcf: buildVCards(cards), count: cards.length };
}

export interface CalendarOptions {
  includeTasks: boolean;
  includeDeals: boolean;
  /** Only tasks assigned to / deals owned by this user. */
  onlyUserId?: string | null;
  /** Absolute origin used for record links, e.g. https://crm.example.com. */
  origin: string;
}

/** Open tasks with a due time and open deals with a close date, as .ics. */
export async function exportCalendar(
  workspaceId: string,
  opts: CalendarOptions
): Promise<{ ics: string; count: number }> {
  const events: IcsEvent[] = [];

  if (opts.includeTasks) {
    const tasks = await fetchAll(
      "tasks",
      "id, title, description, due_at, status, updated_at, assigned_to",
      workspaceId,
      {
        notNull: ["due_at"],
        notIn: { status: ["done", "cancelled"] },
        eq: opts.onlyUserId ? { assigned_to: opts.onlyUserId } : {},
      }
    );
    for (const t of tasks) {
      events.push({
        uid: `task-${t.id}@crm`,
        title: `Task: ${t.title}`,
        description: (t.description as string | null) ?? null,
        url: `${opts.origin}/tasks`,
        start: String(t.due_at),
        updatedAt: (t.updated_at as string | null) ?? null,
      });
    }
  }

  if (opts.includeDeals) {
    const deals = await fetchAll(
      "deals",
      "id, name, expected_close_date, status, updated_at, owner_user_id, value, currency",
      workspaceId,
      {
        notNull: ["expected_close_date"],
        eq: {
          status: "open",
          ...(opts.onlyUserId ? { owner_user_id: opts.onlyUserId } : {}),
        },
      }
    );
    for (const d of deals) {
      events.push({
        uid: `deal-${d.id}@crm`,
        title: `Deal closes: ${d.name}`,
        description:
          d.value != null ? `Value: ${d.value} ${d.currency ?? ""}`.trim() : null,
        url: `${opts.origin}/deals/${d.id}`,
        // expected_close_date is a date column → all-day event.
        start: String(d.expected_close_date).slice(0, 10),
        updatedAt: (d.updated_at as string | null) ?? null,
      });
    }
  }

  return {
    ics: buildIcs(events, { calendarName: "CRM" }),
    count: events.length,
  };
}
