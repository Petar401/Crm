import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getInvoiceLines } from "@/features/billing/queries";
import { renderInvoiceHtml } from "@/features/billing/pdf/template";
import { htmlToPdf } from "@/features/quotes/pdf/render";
import type { BillingInvoice, Workspace } from "@/lib/db/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<BillingInvoice>();
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lines = await getInvoiceLines(invoice.id);

  const [{ data: workspace }, { data: company }, { data: contact }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("name, logo_url")
        .eq("id", ctx.workspace.id)
        .maybeSingle<Pick<Workspace, "name" | "logo_url">>(),
      invoice.company_id
        ? supabase
            .from("companies")
            .select("name,address_line_1,city,postcode,country,email")
            .eq("id", invoice.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      invoice.contact_id
        ? supabase
            .from("contacts")
            .select("full_name,email")
            .eq("id", invoice.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const html = renderInvoiceHtml({
    workspace: workspace ?? { name: ctx.workspace.name, logo_url: null },
    invoice,
    lines,
    company: (company ?? null) as never,
    contact: (contact ?? null) as never,
  });
  const pdf = await htmlToPdf(html);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
