import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  ENTITY_NAMES,
  ENTITY_SPECS,
  entityFieldReference,
  type EntityName,
} from "@/features/mcp/dispatch";
import { getCompanies, getCompany } from "@/features/companies/queries";
import { getContacts, getContact } from "@/features/contacts/queries";
import {
  getDeals,
  getDeal,
  getPipelines,
  getStages,
} from "@/features/deals/queries";
import { getTasks } from "@/features/tasks/queries";
import { getNotes } from "@/features/notes/queries";
import { getLeads } from "@/features/leads/queries";
import { getNotebookNotes } from "@/features/notebook/queries";
import { getEntityActivities } from "@/features/activities/queries";
import { getMemberOptions } from "@/features/team/queries";
import {
  suggestNextStep,
  draftFollowUp,
  draftLeadEmail,
  companyBrief,
} from "@/features/ai/actions";
import { logActivity } from "@/features/activities/log";
import { leadStatuses } from "@/features/leads/schemas";
import type { ActivityType } from "@/lib/db/types";
import { sendEmail } from "@/features/email/actions";
import { resolveEmailCredentials } from "@/features/email/settings-queries";
import { fetchInbox } from "@/features/email/transport";
import { getSentEmails } from "@/features/email/queries";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * Wraps a tool body so a thrown permission error (from `requirePermission`)
 * surfaces to the model as a readable tool error rather than a 500.
 */
async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unexpected error");
  }
}

async function workspaceId(): Promise<string> {
  const ctx = await requireAuthContext();
  return ctx.workspace.id;
}

/**
 * Sanitizes a value that will be templated into a PostgREST `.or(...)` filter
 * or `.ilike(...)` pattern. Removes the OR-filter meta-characters (`,()"`) —
 * any of which would let a caller break out of the current column term and
 * bolt on new predicates — and neutralises the SQL `LIKE` wildcards `%` and
 * `_` so a bare user query can't match every row via `%%`.
 */
function escapePostgrestOrValue(value: string): string {
  return value
    .replace(/[,()"']/g, " ")
    .replace(/[%_\\]/g, " ")
    .trim();
}

export function registerCrmTools(server: McpServer): void {
  // ---------------------------------------------------------------- reads

  server.registerTool(
    "list_companies",
    {
      title: "List companies",
      description:
        "List all companies in the CRM workspace, newest first. Includes contact counts and open deal value.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getCompanies(await workspaceId())))
  );

  server.registerTool(
    "get_company",
    {
      title: "Get company",
      description:
        "Fetch one company by id, with its contacts, deals, and recent activity timeline.",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) =>
      guard(async () => {
        const ws = await workspaceId();
        const company = await getCompany(ws, id);
        if (!company) return fail("Company not found");
        const activities = await getEntityActivities(ws, { companyId: id });
        return ok({ company, activities });
      })
  );

  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description: "List all contacts in the CRM workspace with their company.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getContacts(await workspaceId())))
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get contact",
      description: "Fetch one contact by id.",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) =>
      guard(async () => {
        const contact = await getContact(await workspaceId(), id);
        return contact ? ok(contact) : fail("Contact not found");
      })
  );

  server.registerTool(
    "list_deals",
    {
      title: "List deals",
      description:
        "List all deals with company, contact, and stage. Use list_pipelines to resolve stage ids before moving a deal.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getDeals(await workspaceId())))
  );

  server.registerTool(
    "get_deal",
    {
      title: "Get deal",
      description: "Fetch one deal by id, with its activity timeline.",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) =>
      guard(async () => {
        const ws = await workspaceId();
        const deal = await getDeal(ws, id);
        if (!deal) return fail("Deal not found");
        const activities = await getEntityActivities(ws, { dealId: id });
        return ok({ deal, activities });
      })
  );

  server.registerTool(
    "list_pipelines",
    {
      title: "List pipelines and stages",
      description:
        "List deal pipelines and their stages. Needed to resolve pipeline_id / stage_id when creating or moving deals.",
      inputSchema: z.object({}),
    },
    async () =>
      guard(async () => {
        const ws = await workspaceId();
        const [pipelines, stages] = await Promise.all([
          getPipelines(ws),
          getStages(ws),
        ]);
        return ok({ pipelines, stages });
      })
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List all tasks with assignee, company, and deal, ordered by due date.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getTasks(await workspaceId())))
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "List notes attached to a CRM record. Pass exactly one of the id filters.",
      inputSchema: z.object({
        company_id: z.string().uuid().optional(),
        contact_id: z.string().uuid().optional(),
        deal_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
      }),
    },
    async (args) =>
      guard(async () =>
        ok(
          await getNotes(await workspaceId(), {
            companyId: args.company_id,
            contactId: args.contact_id,
            dealId: args.deal_id,
            leadId: args.lead_id,
          })
        )
      )
  );

  server.registerTool(
    "list_notebook_notes",
    {
      title: "List notebook notes",
      description:
        "List the workspace's standalone notebook notes (not attached to a record).",
      inputSchema: z.object({}),
    },
    async () =>
      guard(async () => ok(await getNotebookNotes(await workspaceId())))
  );

  server.registerTool(
    "list_leads",
    {
      title: "List leads",
      description:
        "List discovered leads, optionally filtered by review status.",
      inputSchema: z.object({
        status: z.enum(leadStatuses).optional(),
      }),
    },
    async ({ status }) =>
      guard(async () => ok(await getLeads(await workspaceId(), status)))
  );

  server.registerTool(
    "list_team_members",
    {
      title: "List team members",
      description:
        "List workspace members. Use to resolve a user id for a task's assigned_to field.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getMemberOptions(await workspaceId())))
  );

  server.registerTool(
    "search",
    {
      title: "Search the CRM",
      description:
        "Free-text search across companies, contacts, deals, and leads. Use this first when the user names a business or person instead of an id.",
      inputSchema: z.object({
        query: z.string().trim().min(1),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ query, limit }) =>
      guard(async () => {
        const ws = await workspaceId();
        const supabase = await createClient();
        // Escape PostgREST OR-filter meta-characters so a query containing
        // commas / parens / quotes can't inject extra terms and read columns
        // the caller was not meant to reach (e.g. `),status.eq.won`).
        const escaped = escapePostgrestOrValue(query);
        const like = `*${escaped}*`;

        const [companies, contacts, deals, leads] = await Promise.all([
          supabase
            .from("companies")
            .select("id, name, industry, city, status")
            .eq("workspace_id", ws)
            .or(`name.ilike.${like},industry.ilike.${like},city.ilike.${like}`)
            .limit(limit),
          supabase
            .from("contacts")
            .select("id, company_id, full_name, email, job_title")
            .eq("workspace_id", ws)
            .or(`full_name.ilike.${like},email.ilike.${like}`)
            .limit(limit),
          supabase
            .from("deals")
            .select("id, company_id, name, value, currency, status")
            .eq("workspace_id", ws)
            .ilike("name", `%${escaped}%`)
            .limit(limit),
          supabase
            .from("leads")
            .select("id, company_name, email, city, status")
            .eq("workspace_id", ws)
            .or(`company_name.ilike.${like},email.ilike.${like}`)
            .limit(limit),
        ]);

        return ok({
          companies: companies.data ?? [],
          contacts: contacts.data ?? [],
          deals: deals.data ?? [],
          leads: leads.data ?? [],
        });
      })
  );

  // --------------------------------------------------------------- writes

  const entityEnum = z.enum(ENTITY_NAMES);
  const fieldRef = entityFieldReference();

  server.registerTool(
    "create_record",
    {
      title: "Create a CRM record",
      description:
        `Create a record. Fields per entity:\n${fieldRef}\n\n` +
        "Resolve company_id with search or list_companies first — do not invent ids.",
      inputSchema: z.object({
        entity: entityEnum,
        data: z.record(z.string(), z.unknown()),
      }),
    },
    async ({ entity, data }) =>
      guard(async () => {
        const spec = ENTITY_SPECS[entity as EntityName];
        if (!spec.create) return fail(`Cannot create a ${entity}`);
        const result = await spec.create(data);
        return result.error ? fail(result.error) : ok({ created: entity, ...result });
      })
  );

  server.registerTool(
    "update_record",
    {
      title: "Update a CRM record",
      description:
        `Update a record by id. Send the complete field set — updates replace, they do not merge. Fields per entity:\n${fieldRef}`,
      inputSchema: z.object({
        entity: entityEnum,
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    },
    async ({ entity, id, data }) =>
      guard(async () => {
        const spec = ENTITY_SPECS[entity as EntityName];
        if (!spec.update) return fail(`Cannot update a ${entity}`);
        const result = await spec.update(id, data);
        return result.error ? fail(result.error) : ok({ updated: entity, id });
      })
  );

  server.registerTool(
    "delete_record",
    {
      title: "Delete a CRM record",
      description:
        "Permanently delete a record. Requires confirm: true — ask the user before calling this.",
      inputSchema: z.object({
        entity: entityEnum,
        id: z.string().uuid(),
        confirm: z.literal(true),
      }),
    },
    async ({ entity, id }) =>
      guard(async () => {
        const spec = ENTITY_SPECS[entity as EntityName];
        if (!spec.remove) return fail(`Cannot delete a ${entity}`);
        const result = await spec.remove(id);
        return result.error ? fail(result.error) : ok({ deleted: entity, id });
      })
  );

  server.registerTool(
    "log_activity",
    {
      title: "Log an activity",
      description:
        "Add an entry to a record's activity timeline — use after a call, email, or meeting the user describes.",
      inputSchema: z.object({
        type: z.enum([
          "note",
          "call",
          "email",
          "meeting",
          "task_created",
          "task_completed",
          "stage_changed",
          "file_uploaded",
        ]),
        title: z.string().trim().optional(),
        detail: z.string().trim().optional(),
        company_id: z.string().uuid().optional(),
        contact_id: z.string().uuid().optional(),
        deal_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
        task_id: z.string().uuid().optional(),
      }),
    },
    async (args) =>
      guard(async () => {
        const ctx = await requireAuthContext();
        await logActivity({
          workspaceId: ctx.workspace.id,
          actorUserId: ctx.userId,
          type: args.type as ActivityType,
          title: args.title,
          detail: args.detail,
          companyId: args.company_id,
          contactId: args.contact_id,
          dealId: args.deal_id,
          leadId: args.lead_id,
          taskId: args.task_id,
        });
        return ok({ logged: true });
      })
  );

  // ---------------------------------------------------------------- email

  server.registerTool(
    "send_email",
    {
      title: "Send an email",
      description:
        "Send an email from the workspace's connected mailbox, optionally linked to a contact, company, or deal.",
      inputSchema: z.object({
        to: z.string().describe("Comma or semicolon separated recipient addresses"),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string(),
        body: z.string(),
        contact_id: z.string().uuid().optional(),
        company_id: z.string().uuid().optional(),
        deal_id: z.string().uuid().optional(),
      }),
    },
    async ({ to, cc, bcc, subject, body, contact_id, company_id, deal_id }) =>
      guard(async () => {
        const result = await sendEmail({
          to,
          cc,
          bcc,
          subject,
          body,
          contactId: contact_id,
          companyId: company_id,
          dealId: deal_id,
        });
        return result.error ? fail(result.error) : ok({ id: result.id });
      })
  );

  server.registerTool(
    "list_inbox_messages",
    {
      title: "List inbox messages",
      description:
        "List the most recent messages in the workspace's connected inbox.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ limit }) =>
      guard(async () => {
        const ctx = await requireAuthContext();
        await requirePermission("email.view");
        const creds = await resolveEmailCredentials(ctx.workspace.id);
        if (!creds) {
          return fail(
            "No mailbox is connected. Connect your business email in Settings before reading the inbox."
          );
        }
        return ok(await fetchInbox(creds, { limit: limit ?? 25 }));
      })
  );

  server.registerTool(
    "list_sent_emails",
    {
      title: "List sent emails",
      description:
        "List emails previously sent from the workspace's connected mailbox.",
      inputSchema: z.object({}),
    },
    async () => guard(async () => ok(await getSentEmails(await workspaceId())))
  );

  // ------------------------------------------------------------ ai helpers

  server.registerTool(
    "ai_deal_insight",
    {
      title: "AI deal insight",
      description:
        "Ask the CRM's own AI for a suggested next step or a draft follow-up email for a deal.",
      inputSchema: z.object({
        deal_id: z.string().uuid(),
        kind: z.enum(["next_step", "follow_up"]),
      }),
    },
    async ({ deal_id, kind }) =>
      guard(async () => {
        const result =
          kind === "next_step"
            ? await suggestNextStep(deal_id)
            : await draftFollowUp(deal_id);
        return result.error ? fail(result.error) : ok({ text: result.text });
      })
  );

  server.registerTool(
    "ai_company_brief",
    {
      title: "AI company brief",
      description:
        "Ask the CRM's own AI for a briefing on a company, based on its CRM record and history.",
      inputSchema: z.object({ company_id: z.string().uuid() }),
    },
    async ({ company_id }) =>
      guard(async () => {
        const result = await companyBrief(company_id);
        return result.error ? fail(result.error) : ok({ text: result.text });
      })
  );

  server.registerTool(
    "ai_lead_email",
    {
      title: "AI lead outreach email",
      description:
        "Ask the CRM's own AI to draft a first outreach email for a discovered lead.",
      inputSchema: z.object({ lead_id: z.string().uuid() }),
    },
    async ({ lead_id }) =>
      guard(async () => {
        const result = await draftLeadEmail(lead_id);
        return result.error ? fail(result.error) : ok({ text: result.text });
      })
  );
}
