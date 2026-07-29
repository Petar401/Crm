import { z } from "zod";

import { companySchema } from "@/features/companies/schemas";
import { contactSchema } from "@/features/contacts/schemas";
import { dealSchema } from "@/features/deals/schemas";
import { taskSchema } from "@/features/tasks/schemas";
import { noteSchema as notebookNoteSchema } from "@/features/notebook/schemas";
import { leadSchema } from "@/features/leads/schemas";
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from "@/features/companies/actions";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/features/contacts/actions";
import { createDeal, updateDeal, deleteDeal } from "@/features/deals/actions";
import { createTask, updateTask, deleteTask } from "@/features/tasks/actions";
import { createNote, deleteNote } from "@/features/notes/actions";
import {
  createNotebookNote,
  updateNotebookNote,
  deleteNotebookNote,
} from "@/features/notebook/actions";
import { createLead, updateLead, deleteLead } from "@/features/leads/actions";

/** A note attached to a CRM record (as opposed to a standalone notebook note). */
const recordNoteSchema = z.object({
  body: z.string().trim().min(1, "Note can't be empty"),
  company_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

interface ActionResultLike {
  error?: string;
  id?: string;
}

interface EntitySpec {
  /** Zod schema for create/update payloads. */
  schema: z.ZodType;
  create?: (values: unknown) => Promise<ActionResultLike>;
  update?: (id: string, values: unknown) => Promise<ActionResultLike>;
  remove?: (id: string) => Promise<ActionResultLike>;
  /** Human-readable field summary, inlined into tool descriptions. */
  fields: string;
}

/**
 * Single source of truth mapping an MCP `entity` argument onto the feature
 * module's existing schema and server actions. Adding a CRM entity means
 * adding one row here — the write tools pick it up automatically.
 */
const SPECS = {
  company: {
    schema: companySchema,
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
    fields:
      "name (required), website, industry, phone, email, address_line_1, city, postcode, country, status (lead|active|customer|inactive, required)",
  },
  contact: {
    schema: contactSchema,
    create: createContact,
    update: updateContact,
    remove: deleteContact,
    fields:
      "company_id (uuid, required), first_name (required), last_name (required), email, phone, job_title, linkedin_url, contact_role (decision_maker|influencer|admin|other, required), is_primary (boolean, required)",
  },
  deal: {
    schema: dealSchema,
    create: createDeal,
    update: updateDeal,
    remove: deleteDeal,
    fields:
      "name (required), company_id (uuid, required), primary_contact_id, pipeline_id, stage_id, value (string number), currency (required, e.g. GBP), probability (string 0-100), expected_close_date (YYYY-MM-DD), status (open|won|lost, required), source, next_step",
  },
  task: {
    schema: taskSchema,
    create: createTask,
    update: updateTask,
    remove: deleteTask,
    fields:
      "title (required), description, status (todo|in_progress|done|cancelled, required), priority (low|medium|high, required), due_at (ISO date), assigned_to (uuid), company_id (uuid), deal_id (uuid)",
  },
  note: {
    schema: recordNoteSchema,
    create: createNote,
    remove: deleteNote,
    fields:
      "body (required), plus one of company_id / contact_id / deal_id / lead_id to attach it to a record",
  },
  notebook_note: {
    schema: notebookNoteSchema,
    create: createNotebookNote,
    update: updateNotebookNote,
    remove: deleteNotebookNote,
    fields: "title (required), body, folder_id",
  },
  lead: {
    schema: leadSchema,
    create: createLead,
    update: updateLead,
    remove: deleteLead,
    fields:
      "company_name (required), website, phone, email, address_line_1, city, country, industry, contact_name, contact_email, contact_phone, job_title, status (pending|approved|rejected|converted)",
  },
} satisfies Record<string, EntitySpec>;

export type EntityName = keyof typeof SPECS;

export const ENTITY_SPECS: Record<EntityName, EntitySpec> = SPECS;

export const ENTITY_NAMES = Object.keys(SPECS) as [EntityName, ...EntityName[]];

/** Field reference for every writable entity, inlined into tool descriptions. */
export function entityFieldReference(): string {
  return ENTITY_NAMES.map(
    (name) => `- ${name}: ${ENTITY_SPECS[name].fields}`
  ).join("\n");
}
