import { createClient } from "@/lib/supabase/server";

/**
 * CRM snapshot bundled into Aria's system prompt on every chat turn.
 *
 * This runs live on every user message using the request-bound Supabase client
 * (RLS-scoped, same client the rest of the app uses). It is intentionally NOT
 * cached: Aria must reflect the workspace as it is right now, so a company,
 * contact, invoice or file added seconds ago is immediately visible. The reads
 * are bounded and run in parallel, so the cost is a single fan-out per message.
 *
 * Every query's `.error` is checked and logged. A failed query must never be
 * silently swallowed into an empty list — that hides real problems (a blank
 * snapshot then makes Aria wrongly claim the CRM is empty).
 *
 * Every table is workspace-scoped, either by an explicit `.eq("workspace_id", ...)`
 * filter (the default) or, for `price_book_entries` which has no `workspace_id`
 * column of its own, by RLS enforcing it via a join through `price_books` (see
 * the `pbe_select` policy in `0029_products.sql`). RLS also naturally narrows a
 * few of these further than the workspace: `notifications` only returns rows
 * addressed to the current user, and `audit_logs`/`products`/`price_books`/
 * `tax_rates` only return rows if the asking user holds the relevant `*.view`
 * permission — both are correct, desired behavior and need no extra code here.
 */

/** Upper bound on rows pulled per entity so the context window stays sane. */
const LIST_CAP = 200;

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

/** Unwraps a Supabase list result, logging (not hiding) any error. */
function rows<T>(label: string, result: QueryResult<T>): T[] {
  if (result.error) {
    console.error(`[aria] failed to load ${label}: ${result.error.message}`);
  }
  return result.data ?? [];
}

/** Whether a capped list may have more rows than were returned. */
function isCapped(returned: number, cap: number): boolean {
  return returned >= cap;
}

export interface AriaFileRef {
  id: string;
  file_name: string;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  source: "attachment" | "invoice" | "email";
}

export interface CrmContext {
  json: string;
  /** All readable files (attachments + invoices + email attachments) keyed by id, for read-on-demand. */
  files: Map<string, AriaFileRef>;
}

export async function getCrmContext(workspaceId: string): Promise<CrmContext> {
  const supabase = await createClient();

  const [
    companies,
    contacts,
    deals,
    tasks,
    activities,
    notebookNotes,
    notes,
    leads,
    invoices,
    attachments,
    dealPipelines,
    dealStages,
    emails,
    products,
    priceBooks,
    priceBookEntries,
    taxRates,
    leadCampaigns,
    members,
    notifications,
    auditLog,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,status,industry,city,country,website,phone,email")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("contacts")
      .select(
        "id,first_name,last_name,email,phone,job_title,company_id,is_primary,contact_role"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("deals")
      .select(
        "id,name,value,currency,status,stage_id,pipeline_id,company_id,probability,expected_close_date"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_at,assigned_to,company_id,deal_id")
      .eq("workspace_id", workspaceId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(LIST_CAP),
    supabase
      .from("activities")
      .select("type,title,detail,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("notebook_notes")
      .select("title,body")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("notes")
      .select("body,company_id,contact_id,deal_id,lead_id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("leads")
      .select(
        "id,company_name,website,industry,city,country,contact_name,job_title,match_score,match_reason,status"
      )
      .eq("workspace_id", workspaceId)
      .order("match_score", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("invoices")
      .select(
        "id,doc_type,vendor,amount,currency,invoice_date,file_name,mime_type,storage_bucket,storage_path"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("attachments")
      .select(
        "id,file_name,mime_type,entity_type,file_size,storage_bucket,storage_path"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("deal_pipelines")
      .select("id,name,is_default")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("deal_stages")
      .select("id,pipeline_id,name,position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }),
    supabase
      .from("emails")
      .select(
        "id,direction,subject,from_email,to_emails,status,company_id,contact_id,deal_id,sent_at,created_at,body_text,attachments"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("products")
      .select(
        "id,sku,name,description,kind,unit,default_currency,default_price,is_archived"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    supabase
      .from("price_books")
      .select("id,name,currency,is_default")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    // No workspace_id column here — RLS scopes this via a join through
    // price_books (see the `pbe_select` policy in 0029_products.sql), so an
    // explicit .eq("workspace_id", ...) filter isn't possible or needed.
    supabase
      .from("price_book_entries")
      .select("id,price_book_id,product_id,unit_price")
      .limit(LIST_CAP),
    supabase
      .from("tax_rates")
      .select("id,name,rate_bps,region,is_default")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("lead_campaigns")
      .select(
        "id,name,business_description,target_categories,location,country,frequency,enabled,last_run_at,last_run_status,last_run_count"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_members")
      .select("user_id,role,is_full_access,profile:profiles(full_name,email)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    // RLS also restricts this to rows addressed to the current user
    // (notifications_select_self), so the workspace filter alone never
    // exposes another member's notifications.
    supabase
      .from("notifications")
      .select("kind,title,body,entity_type,entity_id,read_at,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50),
    // RLS restricts this to users holding audit.view (Owner/Admin by
    // default), so most members will simply get an empty list here.
    supabase
      .from("audit_logs")
      .select("id,actor_user_id,action,entity_type,entity_id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  type StoredFile = {
    id: string;
    file_name: string;
    mime_type: string | null;
    storage_bucket: string;
    storage_path: string;
  };

  const invoiceRows = rows("invoices", invoices) as (StoredFile & {
    doc_type: string;
    vendor: string | null;
    amount: number | null;
    currency: string | null;
    invoice_date: string | null;
  })[];
  const attachmentRows = rows("attachments", attachments) as (StoredFile & {
    entity_type: string;
    file_size: number | null;
  })[];
  const dealRows = rows("deals", deals) as {
    id: string;
    name: string;
    value: number | null;
    currency: string | null;
    status: string;
    stage_id: string | null;
    pipeline_id: string | null;
    company_id: string;
    probability: number | null;
    expected_close_date: string | null;
  }[];
  const pipelineRows = rows("deal_pipelines", dealPipelines) as {
    id: string;
    name: string;
    is_default: boolean;
  }[];
  const stageRows = rows("deal_stages", dealStages) as {
    id: string;
    pipeline_id: string;
    name: string;
    position: number;
  }[];
  const emailRows = rows("emails", emails) as {
    id: string;
    direction: string;
    subject: string | null;
    from_email: string | null;
    to_emails: string[];
    status: string;
    company_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
    sent_at: string | null;
    created_at: string;
    body_text: string | null;
    attachments: { file_name: string; storage_bucket: string; storage_path: string }[] | null;
  }[];
  const memberRows = rows("workspace_members", members) as unknown as {
    user_id: string;
    role: string | null;
    is_full_access: boolean;
    profile: { full_name: string | null; email: string | null } | null;
  }[];

  const pipelineById = new Map(pipelineRows.map((p) => [p.id, p.name]));
  const stageById = new Map(stageRows.map((s) => [s.id, s]));
  const memberNameById = new Map(
    memberRows.map((m) => [
      m.user_id,
      m.profile?.full_name || m.profile?.email || "Unknown",
    ])
  );

  const files = new Map<string, AriaFileRef>();
  const register = (rec: StoredFile, source: "attachment" | "invoice" | "email") => {
    files.set(rec.id, {
      id: rec.id,
      file_name: rec.file_name,
      mime_type: rec.mime_type,
      storage_bucket: rec.storage_bucket,
      storage_path: rec.storage_path,
      source,
    });
  };
  attachmentRows.forEach((a) => register(a, "attachment"));
  invoiceRows.forEach((inv) => register(inv, "invoice"));

  // Register each sent/received email's attachments under a synthetic id
  // (emails carry no id of their own — they're a jsonb snapshot taken at
  // send time), so read_workspace_file can open them like any other file.
  const emailAttachmentIdsByEmail = new Map<string, string[]>();
  emailRows.forEach((email) => {
    const ids = (email.attachments ?? []).map((att, index) => {
      const id = `email:${email.id}:${index}`;
      register(
        {
          id,
          file_name: att.file_name,
          mime_type: null,
          storage_bucket: att.storage_bucket,
          storage_path: att.storage_path,
        },
        "email"
      );
      return id;
    });
    emailAttachmentIdsByEmail.set(email.id, ids);
  });

  // Model-facing views: expose identity + business fields, but never the
  // internal storage bucket/path (Aria reads files via read_workspace_file by id).
  const invoicesView = invoiceRows.map((i) => ({
    id: i.id,
    doc_type: i.doc_type,
    vendor: i.vendor,
    amount: i.amount,
    currency: i.currency,
    invoice_date: i.invoice_date,
    file_name: i.file_name,
    mime_type: i.mime_type,
  }));
  const filesView = attachmentRows.map((a) => ({
    id: a.id,
    file_name: a.file_name,
    mime_type: a.mime_type,
    entity_type: a.entity_type,
    file_size: a.file_size,
  }));
  const dealsView = dealRows.map((d) => {
    const stage = d.stage_id ? stageById.get(d.stage_id) : undefined;
    const pipelineId = d.pipeline_id ?? stage?.pipeline_id ?? null;
    return {
      id: d.id,
      name: d.name,
      value: d.value,
      currency: d.currency,
      status: d.status,
      stage_id: d.stage_id,
      stage_name: stage?.name ?? null,
      pipeline_name: pipelineId ? pipelineById.get(pipelineId) ?? null : null,
      company_id: d.company_id,
      probability: d.probability,
      expected_close_date: d.expected_close_date,
    };
  });
  const emailsView = emailRows.map((e) => ({
    id: e.id,
    direction: e.direction,
    subject: e.subject,
    from_email: e.from_email,
    to_emails: e.to_emails,
    status: e.status,
    company_id: e.company_id,
    contact_id: e.contact_id,
    deal_id: e.deal_id,
    sent_at: e.sent_at,
    created_at: e.created_at,
    // Truncated the same way extractTextFromFile truncates file contents,
    // so one long email thread can't dominate the context on its own.
    body_text: (e.body_text ?? "").slice(0, 1000),
    attachment_ids: emailAttachmentIdsByEmail.get(e.id) ?? [],
  }));
  const teamView = memberRows.map((m) => ({
    user_id: m.user_id,
    name: m.profile?.full_name || m.profile?.email || "Unknown",
    role: m.role,
    is_full_access: m.is_full_access,
  }));
  const tasksView = rows("tasks", tasks).map((t) => ({
    ...t,
    assigned_to_name: t.assigned_to ? memberNameById.get(t.assigned_to) ?? null : null,
  }));

  const companiesData = rows("companies", companies);
  const contactsData = rows("contacts", contacts);
  const activitiesData = rows("activities", activities);
  const notesData = rows("notes", notes);
  const leadsData = rows("leads", leads);
  const notificationsData = rows("notifications", notifications);
  const auditLogData = rows("audit_logs", auditLog);

  const json = JSON.stringify({
    companies: companiesData,
    contacts: contactsData,
    deals: dealsView,
    tasks: tasksView,
    recentActivities: activitiesData,
    notebookNotes: rows("notebook_notes", notebookNotes),
    notes: notesData,
    leads: leadsData,
    invoices: invoicesView,
    files: filesView,
    pipelines: pipelineRows,
    stages: stageRows.map((s) => ({
      id: s.id,
      pipeline_id: s.pipeline_id,
      name: s.name,
      position: s.position,
    })),
    emails: emailsView,
    products: rows("products", products),
    priceBooks: rows("price_books", priceBooks),
    priceBookEntries: rows("price_book_entries", priceBookEntries),
    taxRates: rows("tax_rates", taxRates),
    leadCampaigns: rows("lead_campaigns", leadCampaigns),
    team: teamView,
    notifications: notificationsData,
    auditLog: auditLogData,
    _meta: {
      companies: { returned: companiesData.length, capped: isCapped(companiesData.length, LIST_CAP) },
      contacts: { returned: contactsData.length, capped: isCapped(contactsData.length, LIST_CAP) },
      deals: { returned: dealsView.length, capped: isCapped(dealsView.length, LIST_CAP) },
      tasks: { returned: tasksView.length, capped: isCapped(tasksView.length, LIST_CAP) },
      recentActivities: { returned: activitiesData.length, capped: isCapped(activitiesData.length, 40) },
      notes: { returned: notesData.length, capped: isCapped(notesData.length, 100) },
      leads: { returned: leadsData.length, capped: isCapped(leadsData.length, 50) },
      invoices: { returned: invoicesView.length, capped: isCapped(invoicesView.length, LIST_CAP) },
      files: { returned: filesView.length, capped: isCapped(filesView.length, LIST_CAP) },
      emails: { returned: emailsView.length, capped: isCapped(emailsView.length, 100) },
      auditLog: { returned: auditLogData.length, capped: isCapped(auditLogData.length, 100) },
    },
  });

  return { json, files };
}
