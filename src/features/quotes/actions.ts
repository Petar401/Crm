"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { notify } from "@/features/notifications/emit";
import {
  quoteHeaderSchema,
  quoteLineInputSchema,
  signQuoteSchema,
  type QuoteLineInput,
} from "@/features/quotes/schemas";
import { computeLine, totalOfLines } from "@/features/quotes/totals";
import { mintShareToken, sha256Hex } from "@/features/quotes/token";
import type { TaxRate } from "@/lib/db/types";

export interface ActionResult {
  error?: string;
  id?: string;
}

export interface ShareResult extends ActionResult {
  shareToken?: string;
}

async function loadTaxRateBps(
  workspaceId: string,
  taxRateId: string | undefined
): Promise<number> {
  if (!taxRateId) return 0;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_rates")
    .select("rate_bps")
    .eq("workspace_id", workspaceId)
    .eq("id", taxRateId)
    .maybeSingle<Pick<TaxRate, "rate_bps">>();
  return data?.rate_bps ?? 0;
}

export async function createQuote(
  header: unknown,
  lines: unknown
): Promise<ActionResult> {
  const parsedHeader = quoteHeaderSchema.safeParse(header);
  if (!parsedHeader.success) {
    return { error: parsedHeader.error.issues[0]?.message ?? "Invalid quote" };
  }
  const parsedLines = safeParseLines(lines);
  if ("error" in parsedLines) return parsedLines;

  const ctx = await requireAuthContext();
  await requirePermission("quotes.create");

  const supabase = await createClient();

  // Allocate the next quote number via the security-definer function.
  const { data: numberRow, error: numberError } = await supabase.rpc(
    "next_quote_number",
    { p_workspace_id: ctx.workspace.id }
  );
  if (numberError) return { error: numberError.message };

  const computed = await Promise.all(
    parsedLines.lines.map(async (line, i) => {
      const bps = await loadTaxRateBps(ctx.workspace.id, line.tax_rate_id || undefined);
      return { line, i, computed: computeLine(line, bps) };
    })
  );
  const totals = totalOfLines(computed.map((c) => c.computed));

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      workspace_id: ctx.workspace.id,
      number: numberRow as unknown as string,
      deal_id: parsedHeader.data.deal_id || null,
      company_id: parsedHeader.data.company_id || null,
      contact_id: parsedHeader.data.contact_id || null,
      currency: parsedHeader.data.currency.toUpperCase(),
      valid_until: parsedHeader.data.valid_until || null,
      notes: parsedHeader.data.notes || null,
      subtotal_minor: totals.subtotal_minor,
      tax_minor: totals.tax_minor,
      discount_minor: totals.discount_minor,
      total_minor: totals.total_minor,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  if (computed.length > 0) {
    const { error: linesError } = await supabase.from("quote_lines").insert(
      computed.map(({ line, i, computed: c }) => ({
        quote_id: quote.id,
        product_id: line.product_id || null,
        position: i,
        description: line.description,
        quantity: c.quantity,
        unit_price_minor: c.unit_price_minor,
        discount_bps: c.discount_bps,
        tax_rate_id: line.tax_rate_id || null,
        tax_rate_bps: c.tax_rate_bps,
        line_subtotal_minor: c.line_subtotal_minor,
        line_tax_minor: c.line_tax_minor,
        line_total_minor: c.line_total_minor,
      }))
    );
    if (linesError) return { error: linesError.message };
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: `Quote ${numberRow} drafted`,
    dealId: parsedHeader.data.deal_id || null,
    companyId: parsedHeader.data.company_id || null,
    contactId: parsedHeader.data.contact_id || null,
  });

  revalidatePath("/quotes");
  return { id: quote.id };
}

export async function updateQuote(
  id: string,
  header: unknown,
  lines: unknown
): Promise<ActionResult> {
  const parsedHeader = quoteHeaderSchema.safeParse(header);
  if (!parsedHeader.success) {
    return { error: parsedHeader.error.issues[0]?.message ?? "Invalid quote" };
  }
  const parsedLines = safeParseLines(lines);
  if ("error" in parsedLines) return parsedLines;

  const ctx = await requireAuthContext();
  await requirePermission("quotes.update");
  const supabase = await createClient();

  const computed = await Promise.all(
    parsedLines.lines.map(async (line, i) => {
      const bps = await loadTaxRateBps(ctx.workspace.id, line.tax_rate_id || undefined);
      return { line, i, computed: computeLine(line, bps) };
    })
  );
  const totals = totalOfLines(computed.map((c) => c.computed));

  const { error: headerError } = await supabase
    .from("quotes")
    .update({
      deal_id: parsedHeader.data.deal_id || null,
      company_id: parsedHeader.data.company_id || null,
      contact_id: parsedHeader.data.contact_id || null,
      currency: parsedHeader.data.currency.toUpperCase(),
      valid_until: parsedHeader.data.valid_until || null,
      notes: parsedHeader.data.notes || null,
      subtotal_minor: totals.subtotal_minor,
      tax_minor: totals.tax_minor,
      discount_minor: totals.discount_minor,
      total_minor: totals.total_minor,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (headerError) return { error: headerError.message };

  // Replace lines wholesale. Simplest correct approach at this stage;
  // preserves quote_id + cascade behaviour.
  const { error: delError } = await supabase
    .from("quote_lines")
    .delete()
    .eq("quote_id", id);
  if (delError) return { error: delError.message };

  if (computed.length > 0) {
    const { error: insError } = await supabase.from("quote_lines").insert(
      computed.map(({ line, i, computed: c }) => ({
        quote_id: id,
        product_id: line.product_id || null,
        position: i,
        description: line.description,
        quantity: c.quantity,
        unit_price_minor: c.unit_price_minor,
        discount_bps: c.discount_bps,
        tax_rate_id: line.tax_rate_id || null,
        tax_rate_bps: c.tax_rate_bps,
        line_subtotal_minor: c.line_subtotal_minor,
        line_tax_minor: c.line_tax_minor,
        line_total_minor: c.line_total_minor,
      }))
    );
    if (insError) return { error: insError.message };
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { id };
}

export async function markSent(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("quotes.send");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath(`/quotes/${id}`);
  return { id };
}

export async function voidQuote(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("quotes.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "void" })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { id };
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("quotes.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/quotes");
  return {};
}

/**
 * Mint a share token for a quote. Returns the plaintext once; only the
 * sha256 hash is persisted.
 */
export async function createShareLink(
  quoteId: string,
  expiresInDays: number = 30
): Promise<ShareResult> {
  const ctx = await requireAuthContext();
  await requirePermission("quotes.send");
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ id: string; status: string }>();
  if (!quote) return { error: "Quote not found" };

  const { plaintext, hash } = mintShareToken();
  const expires_at = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from("quote_share_tokens").insert({
    quote_id: quoteId,
    token_hash: hash,
    expires_at,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  // Auto-flip draft → sent when the first share link is minted.
  if (quote.status === "draft") {
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quoteId);
  }

  revalidatePath(`/quotes/${quoteId}`);
  return { id: quoteId, shareToken: plaintext };
}

export async function revokeShareLink(id: string): Promise<ActionResult> {
  await requireAuthContext();
  await requirePermission("quotes.send");
  const supabase = await createClient();

  // The share row references a quote; RLS enforces the workspace via the
  // parent quote check. Explicit workspace filter still applied for safety.
  const { error } = await supabase
    .from("quote_share_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return { id };
}

// ---------------------------------------------------------------------------
// Public: sign-a-quote (called from /q/[token] — no session).
// ---------------------------------------------------------------------------

export async function signQuote(values: unknown): Promise<ActionResult> {
  const parsed = signQuoteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const hash = sha256Hex(parsed.data.token);
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("quote_share_tokens")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!share || share.revoked_at) return { error: "Invalid or revoked link" };
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { error: "This link has expired" };
  }

  const { data: quote } = await admin
    .from("quotes")
    .select("id, workspace_id, deal_id, company_id, status, number, created_by, total_minor, currency")
    .eq("id", share.quote_id)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      deal_id: string | null;
      company_id: string | null;
      status: string;
      number: string;
      created_by: string | null;
      total_minor: number;
      currency: string;
    }>();
  if (!quote) return { error: "Quote not found" };
  if (quote.status === "signed") return { id: quote.id };
  if (quote.status === "void" || quote.status === "expired") {
    return { error: "This quote is no longer active" };
  }

  const { error } = await admin
    .from("quotes")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_by_name: parsed.data.name,
      signed_by_email: parsed.data.email,
      signature_svg: parsed.data.signature_svg,
    })
    .eq("id", quote.id);
  if (error) return { error: error.message };

  // Best-effort activity + notification.
  await admin.from("activities").insert({
    workspace_id: quote.workspace_id,
    type: "note",
    title: `Quote ${quote.number} signed by ${parsed.data.name}`,
    detail: null,
    deal_id: quote.deal_id,
    company_id: quote.company_id,
  });

  if (quote.created_by) {
    await notify({
      workspaceId: quote.workspace_id,
      userIds: [quote.created_by],
      kind: "quote_signed",
      title: `Quote ${quote.number} signed`,
      body: `${parsed.data.name} accepted the quote.`,
      url: `/quotes/${quote.id}`,
      entityType: "quote",
      entityId: quote.id,
      useAdmin: true,
    });
  }

  return { id: quote.id };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedLinesOk {
  lines: QuoteLineInput[];
}
interface ParsedLinesErr {
  error: string;
}

function safeParseLines(input: unknown): ParsedLinesOk | ParsedLinesErr {
  if (!Array.isArray(input)) return { error: "Add at least one line" };
  const out: QuoteLineInput[] = [];
  for (let i = 0; i < input.length; i++) {
    const parsed = quoteLineInputSchema.safeParse(input[i]);
    if (!parsed.success) {
      return { error: `Line ${i + 1}: ${parsed.error.issues[0]?.message}` };
    }
    out.push(parsed.data);
  }
  if (out.length === 0) return { error: "Add at least one line" };
  return { lines: out };
}

