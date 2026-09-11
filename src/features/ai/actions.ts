"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { generateText } from "@/features/ai/generate-text";
import {
  resolveAiCredentials,
  type AiCredentials,
} from "@/features/ai/settings-queries";
import { logActivity } from "@/features/activities/log";
import type { Deal, Lead } from "@/lib/db/types";

export interface AiResult {
  text?: string;
  error?: string;
}

const SYSTEM =
  "You are a concise, professional CRM assistant for a B2B sales team. " +
  "Write in clear British English. Be specific and actionable. Never invent facts.";

type AuthorizeResult =
  | { ok: true; ws: string; user: string; credentials: AiCredentials }
  | { ok: false; error: string };

async function authorizeAi(): Promise<AuthorizeResult> {
  const ctx = await requireAuthContext();
  await requirePermission("ai.use");

  const credentials = await resolveAiCredentials(ctx.workspace.id);
  if (!credentials) {
    return {
      ok: false,
      error: "AI is not configured. Add an API key in Settings.",
    };
  }
  return { ok: true, ws: ctx.workspace.id, user: ctx.userId, credentials };
}

export async function summarizeText(input: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };
  if (!input.trim()) return { error: "Nothing to summarize." };

  try {
    const text = await generateText(
      `Summarize the following note in 2-3 short sentences, capturing key facts and any action items:\n\n${input}`,
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export async function suggestNextStep(dealId: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("workspace_id", auth.ws)
    .maybeSingle<Deal>();
  if (!deal) return { error: "Deal not found." };

  const { data: notes } = await supabase
    .from("notes")
    .select("body")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(5);

  const context = [
    `Deal: ${deal.name}`,
    `Value: ${deal.value ?? "unknown"} ${deal.currency}`,
    `Status: ${deal.status}`,
    deal.next_step ? `Current next step: ${deal.next_step}` : null,
    notes?.length
      ? `Recent notes:\n${notes.map((n) => `- ${n.body}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await generateText(
      `Based on this deal, suggest the single best next step to move it forward. ` +
        `Give one short paragraph and a one-line recommended action.\n\n${context}`,
      SYSTEM,
      auth.credentials
    );
    await logActivity({
      workspaceId: auth.ws,
      actorUserId: auth.user,
      type: "note",
      title: "AI suggested next step",
      dealId,
    });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export async function draftFollowUp(dealId: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("workspace_id", auth.ws)
    .maybeSingle<Deal>();
  if (!deal) return { error: "Deal not found." };

  try {
    const text = await generateText(
      `Draft a short, friendly but professional follow-up email for this deal. ` +
        `Keep it under 120 words. Deal: ${deal.name}, value ${deal.value ?? "?"} ${deal.currency}, status ${deal.status}.` +
        (deal.next_step ? ` Planned next step: ${deal.next_step}.` : ""),
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export async function draftLeadEmail(leadId: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("workspace_id", auth.ws)
    .maybeSingle<Lead>();
  if (!lead) return { error: "Lead not found." };

  let businessDescription = "";
  if (lead.campaign_id) {
    const { data: campaign } = await supabase
      .from("lead_campaigns")
      .select("business_description")
      .eq("id", lead.campaign_id)
      .eq("workspace_id", auth.ws)
      .maybeSingle<{ business_description: string }>();
    businessDescription = campaign?.business_description ?? "";
  }

  try {
    const text = await generateText(
      `Draft a short, personalised cold-outreach email to this prospect. ` +
        `Keep it under 120 words: a relevant hook, one line of value, and a soft call to action. ` +
        `Do not invent facts about them.\n\n` +
        (businessDescription ? `Our business: ${businessDescription}\n` : "") +
        `Prospect: ${JSON.stringify({
          company: lead.company_name,
          industry: lead.industry,
          city: lead.city,
          website: lead.website,
          contact: lead.contact_name,
          role: lead.job_title,
        })}`,
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export interface EmailDraftResult {
  subject?: string;
  text?: string;
  error?: string;
}

/** Splits a "Subject: ...\n\n<body>" completion into its parts. */
function splitSubjectAndBody(raw: string): { subject?: string; text: string } {
  const match = raw.match(/^Subject:\s*(.+)\r?\n+([\s\S]*)$/i);
  if (match) return { subject: match[1].trim(), text: match[2].trim() };
  return { text: raw.trim() };
}

export async function draftEmailFromPrompt(
  instruction: string,
  opts?: { contactId?: string; companyId?: string; dealId?: string }
): Promise<EmailDraftResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };
  if (!instruction.trim()) return { error: "Describe what the email should say." };

  const supabase = await createClient();
  const contextLines: string[] = [];

  if (opts?.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("full_name, job_title")
      .eq("id", opts.contactId)
      .eq("workspace_id", auth.ws)
      .maybeSingle<{ full_name: string; job_title: string | null }>();
    if (contact) {
      contextLines.push(
        `Contact: ${contact.full_name}${contact.job_title ? ` (${contact.job_title})` : ""}`
      );
    }
  }
  if (opts?.companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("name, industry")
      .eq("id", opts.companyId)
      .eq("workspace_id", auth.ws)
      .maybeSingle<{ name: string; industry: string | null }>();
    if (company) {
      contextLines.push(
        `Company: ${company.name}${company.industry ? ` (${company.industry})` : ""}`
      );
    }
  }
  if (opts?.dealId) {
    const { data: deal } = await supabase
      .from("deals")
      .select("name, value, currency, status, next_step")
      .eq("id", opts.dealId)
      .eq("workspace_id", auth.ws)
      .maybeSingle<Deal>();
    if (deal) {
      contextLines.push(
        `Deal: ${deal.name}, value ${deal.value ?? "unknown"} ${deal.currency}, status ${deal.status}` +
          (deal.next_step ? `, next step: ${deal.next_step}` : "")
      );
    }
  }

  try {
    const raw = await generateText(
      `Draft an email based on this instruction: "${instruction}".` +
        (contextLines.length ? `\n\nContext:\n${contextLines.join("\n")}` : "") +
        `\n\nReply with exactly: the first line "Subject: <subject>", a blank line, ` +
        `then only the email body — no other commentary.`,
      SYSTEM,
      auth.credentials
    );
    return splitSubjectAndBody(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export interface EmailReplyContext {
  fromEmail?: string;
  originalSubject?: string;
  originalText?: string | null;
}

// No DB read here: inbound messages are fetched live over IMAP and have no
// durable row, so all context is whatever the caller already has on screen
// (works the same for replying to a sent email, whose context comes from the
// already-loaded `emails` row).
export async function draftEmailReply(
  context: EmailReplyContext,
  instruction: string
): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };
  if (!instruction.trim()) return { error: "Describe how you'd like to reply." };

  try {
    const text = await generateText(
      `Draft a reply to the email below, following this instruction: "${instruction}". ` +
        `Keep it under 150 words. Write only the reply body — no subject line, no quoted text.\n\n` +
        `From: ${context.fromEmail ?? "unknown"}\n` +
        `Subject: ${context.originalSubject ?? "(no subject)"}\n` +
        `Message:\n${(context.originalText ?? "").slice(0, 4000)}`,
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

// Pure text-in/text-out, no DB round-trip — used to revise whatever is
// currently typed in a compose draft.
export async function reviseEmailText(
  currentText: string,
  instruction: string
): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };
  if (!currentText.trim()) return { error: "Write a draft first." };
  if (!instruction.trim()) return { error: "Describe the change you'd like." };

  try {
    const text = await generateText(
      `Revise the email draft below according to this instruction: "${instruction}". ` +
        `Keep the same intent and any names/facts/figures unchanged. ` +
        `Return only the revised body text, nothing else.\n\n${currentText}`,
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export async function companyBrief(companyId: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("name, industry, website, city, country, status")
    .eq("id", companyId)
    .eq("workspace_id", auth.ws)
    .maybeSingle();
  if (!company) return { error: "Company not found." };

  try {
    const text = await generateText(
      `Write a 3-4 sentence internal brief about this company for a sales rep, ` +
        `noting likely priorities and a sensible angle of approach. ` +
        `Do not fabricate specific facts; reason from what's given.\n\n${JSON.stringify(company)}`,
      SYSTEM,
      auth.credentials
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}
