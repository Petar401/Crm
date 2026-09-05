import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { vatReport } from "@/features/billing/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("billing.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from/to required" }, { status: 400 });
  }

  const brackets = await vatReport(
    ctx.workspace.id,
    `${from}T00:00:00Z`,
    `${to}T23:59:59Z`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("VAT report");
  sheet.columns = [
    { header: "Tax rate", key: "name", width: 24 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Taxable", key: "taxable", width: 16 },
    { header: "Tax", key: "tax", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const b of brackets) {
    sheet.addRow({
      name: b.tax_rate_name,
      rate: `${(b.rate_bps / 100).toFixed(2)}%`,
      currency: b.currency,
      taxable: b.taxable_minor / 100,
      tax: b.tax_minor / 100,
    });
  }

  sheet.getColumn("taxable").numFmt = "#,##0.00";
  sheet.getColumn("tax").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="vat-${from}-to-${to}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
