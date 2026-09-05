import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getQuoteLines } from "@/features/quotes/queries";
import { renderQuoteHtml } from "@/features/quotes/pdf/template";
import { htmlToPdf } from "@/features/quotes/pdf/render";
import { sha256Hex } from "@/features/quotes/token";
import type { Quote, Workspace } from "@/lib/db/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Serves the PDF for a quote.
 * - Session users: RLS-authorised read via the normal server client.
 * - Public: pass `?token=<share token>`; verified via sha256 lookup on
 *   `quote_share_tokens`. No session required.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const bundle = token
    ? await loadFromToken(id, token)
    : await loadFromSession(id);
  if (!bundle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const html = renderQuoteHtml(bundle);
  const pdf = await htmlToPdf(html);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="quote-${bundle.quote.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

async function loadFromSession(id: string) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("quotes.view")) return null;

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Quote>();
  if (!quote) return null;

  const lines = await getQuoteLines(quote.id);
  const [{ data: workspace }, { data: company }, { data: contact }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("name, logo_url")
        .eq("id", ctx.workspace.id)
        .maybeSingle<Pick<Workspace, "name" | "logo_url">>(),
      quote.company_id
        ? supabase
            .from("companies")
            .select("id,name,email,address_line_1,city,postcode,country")
            .eq("id", quote.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      quote.contact_id
        ? supabase
            .from("contacts")
            .select("id,full_name,email")
            .eq("id", quote.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    workspace: workspace ?? { name: ctx.workspace.name, logo_url: null },
    quote,
    lines,
    company: (company ?? null) as never,
    contact: (contact ?? null) as never,
  };
}

async function loadFromToken(id: string, token: string) {
  const hash = sha256Hex(token);
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("quote_share_tokens")
    .select("*")
    .eq("token_hash", hash)
    .eq("quote_id", id)
    .maybeSingle();
  if (!share || share.revoked_at) return null;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle<Quote>();
  if (!quote) return null;

  const { data: lines } = await admin
    .from("quote_lines")
    .select("*")
    .eq("quote_id", quote.id)
    .order("position", { ascending: true });

  const [{ data: workspace }, { data: company }, { data: contact }] =
    await Promise.all([
      admin
        .from("workspaces")
        .select("name, logo_url")
        .eq("id", quote.workspace_id)
        .maybeSingle<Pick<Workspace, "name" | "logo_url">>(),
      quote.company_id
        ? admin
            .from("companies")
            .select("id,name,email,address_line_1,city,postcode,country")
            .eq("id", quote.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      quote.contact_id
        ? admin
            .from("contacts")
            .select("id,full_name,email")
            .eq("id", quote.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    workspace: workspace ?? { name: "Quote", logo_url: null },
    quote,
    lines: (lines ?? []) as never,
    company: (company ?? null) as never,
    contact: (contact ?? null) as never,
  };
}
