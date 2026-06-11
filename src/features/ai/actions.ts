"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { generateText, isAiConfigured } from "@/features/ai/gemini";
import { logActivity } from "@/features/activities/log";
import type { Deal } from "@/lib/db/types";

export interface AiResult {
  text?: string;
  error?: string;
}

const SYSTEM =
  "You are a concise, professional CRM assistant for a B2B sales team. " +
  "Write in clear British English. Be specific and actionable. Never invent facts.";

type AuthorizeResult =
  | { ok: true; ws: string; user: string }
  | { ok: false; error: string };

async function authorizeAi(): Promise<AuthorizeResult> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      error: "AI is not configured. Add a GEMINI_API_KEY to enable it.",
    };
  }
  const ctx = await requireAuthContext();
  await requirePermission("ai.use");
  return { ok: true, ws: ctx.workspace.id, user: ctx.userId };
}

export async function summarizeText(input: string): Promise<AiResult> {
  const auth = await authorizeAi();
  if (!auth.ok) return { error: auth.error };
  if (!input.trim()) return { error: "Nothing to summarize." };

  try {
    const text = await generateText(
      `Summarize the following note in 2-3 short sentences, capturing key facts and any action items:\n\n${input}`,
      SYSTEM
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
      SYSTEM
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
      SYSTEM
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
      SYSTEM
    );
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}
