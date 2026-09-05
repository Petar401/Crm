"use server";

import { requireAuthContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SearchKind =
  | "company"
  | "contact"
  | "deal"
  | "lead"
  | "note"
  | "notebook";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Sanitises a value templated into a PostgREST `.or(...)` filter or `ilike`
 * pattern. Mirrors the guard in features/mcp/tools.ts — drops the OR-filter
 * meta-characters (`,()"`) and the LIKE wildcards (`%`, `_`).
 */
function escape(value: string): string {
  return value
    .replace(/[,()"']/g, " ")
    .replace(/[%_\\]/g, " ")
    .trim();
}

export async function search(
  query: string,
  limit = 6
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const escaped = escape(trimmed);
  if (!escaped) return [];
  const like = `*${escaped}*`;
  const ws = ctx.workspace.id;

  const [companies, contacts, deals, leads, notes, notebook] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, industry, city")
      .eq("workspace_id", ws)
      .or(`name.ilike.${like},industry.ilike.${like},city.ilike.${like}`)
      .limit(limit),
    supabase
      .from("contacts")
      .select("id, full_name, email, job_title")
      .eq("workspace_id", ws)
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(limit),
    supabase
      .from("deals")
      .select("id, name, currency, value")
      .eq("workspace_id", ws)
      .ilike("name", `%${escaped}%`)
      .limit(limit),
    supabase
      .from("leads")
      .select("id, company_name, contact_name")
      .eq("workspace_id", ws)
      .or(`company_name.ilike.${like},contact_name.ilike.${like}`)
      .limit(limit),
    supabase
      .from("notes")
      .select("id, body, company_id, deal_id, contact_id, lead_id")
      .eq("workspace_id", ws)
      .ilike("body", `%${escaped}%`)
      .limit(limit),
    supabase
      .from("notebook_notes")
      .select("id, title, body")
      .eq("workspace_id", ws)
      .or(`title.ilike.${like},body.ilike.${like}`)
      .limit(limit),
  ]);

  const out: SearchResult[] = [];

  for (const c of companies.data ?? []) {
    out.push({
      kind: "company",
      id: c.id,
      title: c.name,
      subtitle: [c.industry, c.city].filter(Boolean).join(" · ") || "Company",
      href: `/companies/${c.id}`,
    });
  }
  for (const c of contacts.data ?? []) {
    out.push({
      kind: "contact",
      id: c.id,
      title: c.full_name,
      subtitle: [c.job_title, c.email].filter(Boolean).join(" · ") || "Contact",
      href: `/contacts/${c.id}`,
    });
  }
  for (const d of deals.data ?? []) {
    out.push({
      kind: "deal",
      id: d.id,
      title: d.name,
      subtitle: d.value ? `${d.currency ?? ""} ${d.value}`.trim() : "Deal",
      href: `/deals/${d.id}`,
    });
  }
  for (const l of leads.data ?? []) {
    out.push({
      kind: "lead",
      id: l.id,
      title: l.company_name,
      subtitle: l.contact_name || "Lead",
      href: `/leads/${l.id}`,
    });
  }
  for (const n of notes.data ?? []) {
    const anchor = n.deal_id
      ? `/deals/${n.deal_id}`
      : n.contact_id
        ? `/contacts/${n.contact_id}`
        : n.lead_id
          ? `/leads/${n.lead_id}`
          : n.company_id
            ? `/companies/${n.company_id}`
            : "/notes";
    const snippet = (n.body ?? "").slice(0, 80);
    out.push({
      kind: "note",
      id: n.id,
      title: snippet || "Note",
      subtitle: "Record note",
      href: anchor,
    });
  }
  for (const nn of notebook.data ?? []) {
    out.push({
      kind: "notebook",
      id: nn.id,
      title: nn.title || (nn.body ?? "").slice(0, 60) || "Note",
      subtitle: "Notebook",
      href: `/notes`,
    });
  }

  return out;
}
