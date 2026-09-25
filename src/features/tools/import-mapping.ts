import { unguardCsvCell } from "@/lib/utils/csv";

/**
 * Maps CSV records (keys already normalised by `parseCsvRecords`) onto CRM
 * fields for the import dialog. Pure, so the client preview and the server
 * action use exactly the same rules — the server re-maps and re-validates
 * everything and never trusts the client's result.
 */

export const IMPORT_ENTITIES = ["companies", "contacts"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

/** Per import; keeps a request well inside the server-action body limit. */
export const IMPORT_MAX_ROWS = 1000;
/** Longest accepted cell; anything longer is almost certainly a bad column. */
export const IMPORT_MAX_CELL = 2000;

type Aliases = Record<string, readonly string[]>;

const COMPANY_ALIASES: Aliases = {
  name: ["name", "company", "company_name", "organisation", "organization", "business", "business_name", "client", "client_name", "account", "account_name"],
  website: ["website", "url", "web", "site", "domain", "homepage"],
  industry: ["industry", "sector", "category", "type"],
  phone: ["phone", "telephone", "tel", "phone_number", "mobile", "landline"],
  email: ["email", "e_mail", "email_address", "mail"],
  address_line_1: ["address", "address_line_1", "address1", "address_1", "street", "street_address", "address_line1"],
  city: ["city", "town", "town_city", "locality"],
  postcode: ["postcode", "post_code", "postal_code", "zip", "zip_code", "zipcode"],
  country: ["country", "nation"],
  status: ["status", "stage", "lifecycle"],
};

const CONTACT_ALIASES: Aliases = {
  first_name: ["first_name", "firstname", "first", "given_name", "forename"],
  last_name: ["last_name", "lastname", "last", "surname", "family_name"],
  full_name: ["name", "full_name", "fullname", "contact_name", "contact"],
  company: ["company", "company_name", "organisation", "organization", "business", "account", "account_name", "client", "client_name"],
  email: ["email", "e_mail", "email_address", "mail"],
  phone: ["phone", "telephone", "tel", "phone_number", "mobile"],
  job_title: ["job_title", "title", "position", "job"],
  linkedin_url: ["linkedin", "linkedin_url", "linkedin_profile"],
};

const ALIASES: Record<ImportEntity, Aliases> = {
  companies: COMPANY_ALIASES,
  contacts: CONTACT_ALIASES,
};

/** Human labels for the preview table. */
export const IMPORT_FIELD_LABELS: Record<ImportEntity, Record<string, string>> = {
  companies: {
    name: "Name",
    website: "Website",
    industry: "Industry",
    phone: "Phone",
    email: "Email",
    address_line_1: "Address",
    city: "City",
    postcode: "Postcode",
    country: "Country",
    status: "Status",
  },
  contacts: {
    first_name: "First name",
    last_name: "Last name",
    full_name: "Full name",
    company: "Company",
    email: "Email",
    phone: "Phone",
    job_title: "Job title",
    linkedin_url: "LinkedIn",
  },
};

/** Which CSV header feeds each CRM field (first alias found wins). */
export function detectColumns(
  entity: ImportEntity,
  headers: readonly string[]
): Record<string, string> {
  const available = new Set(headers);
  const mapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(ALIASES[entity])) {
    const hit = aliases.find((a) => available.has(a));
    if (hit) mapping[field] = hit;
  }
  return mapping;
}

/**
 * Applies a column mapping to one record: trims, removes the CSV export's
 * formula-guard apostrophe, and caps the length.
 */
export function mapRecord(
  record: Readonly<Record<string, string>>,
  mapping: Readonly<Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(mapping)) {
    const value = unguardCsvCell((record[header] ?? "").trim()).slice(
      0,
      IMPORT_MAX_CELL
    );
    if (value) out[field] = value;
  }
  return out;
}

/**
 * Contact name parts: explicit first/last columns win; otherwise a full name
 * is split on the first space ("Mary Ann Smith" → "Mary" / "Ann Smith").
 */
export function contactNameParts(fields: Readonly<Record<string, string>>): {
  first: string;
  last: string;
} {
  let first = fields.first_name ?? "";
  let last = fields.last_name ?? "";
  if ((!first || !last) && fields.full_name) {
    const [head, ...rest] = fields.full_name.split(/\s+/);
    if (!first) first = head ?? "";
    if (!last) last = rest.join(" ");
  }
  return { first: first.trim(), last: last.trim() };
}

/** Case/space-insensitive key for matching names and emails. */
export function matchKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
