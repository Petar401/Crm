"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type {
  Company,
  Contact,
  Deal,
  Product,
  Quote,
  QuoteLine,
  TaxRate,
} from "@/lib/db/types";
import { createQuote, updateQuote } from "@/features/quotes/actions";
import { computeLine, totalOfLines } from "@/features/quotes/totals";
import { formatMinor } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  quote?: Quote;
  lines?: QuoteLine[];
  deals: Pick<Deal, "id" | "name" | "company_id" | "primary_contact_id" | "currency">[];
  companies: Pick<Company, "id" | "name">[];
  contacts: Pick<Contact, "id" | "full_name" | "company_id">[];
  products: Product[];
  taxRates: TaxRate[];
}

interface LineDraft {
  key: string;
  product_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_bps: string;
  tax_rate_id: string;
}

const NONE = "__none";

function newLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    product_id: "",
    description: "",
    quantity: "1",
    unit_price: "0.00",
    discount_bps: "0",
    tax_rate_id: "",
  };
}

export function QuoteEditor({
  quote,
  lines: existingLines,
  deals,
  companies,
  contacts,
  products,
  taxRates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!quote;

  const [header, setHeader] = useState({
    deal_id: quote?.deal_id ?? "",
    company_id: quote?.company_id ?? "",
    contact_id: quote?.contact_id ?? "",
    currency: quote?.currency ?? "GBP",
    valid_until: quote?.valid_until ?? "",
    notes: quote?.notes ?? "",
  });

  const [lines, setLines] = useState<LineDraft[]>(
    existingLines && existingLines.length > 0
      ? existingLines.map((l) => ({
          key: l.id,
          product_id: l.product_id ?? "",
          description: l.description,
          quantity: String(l.quantity),
          unit_price: (l.unit_price_minor / 100).toFixed(2),
          discount_bps: String(l.discount_bps),
          tax_rate_id: l.tax_rate_id ?? "",
        }))
      : [newLine()]
  );

  const taxRateBpsById = useMemo(
    () => new Map(taxRates.map((r) => [r.id, r.rate_bps])),
    [taxRates]
  );

  const computed = useMemo(() => {
    return lines.map((l) => {
      try {
        return computeLine(
          {
            product_id: l.product_id,
            description: l.description || "line",
            quantity: l.quantity || "0",
            unit_price: l.unit_price || "0",
            discount_bps: l.discount_bps || "0",
            tax_rate_id: l.tax_rate_id,
          },
          taxRateBpsById.get(l.tax_rate_id) ?? 0
        );
      } catch {
        return {
          quantity: 0,
          unit_price_minor: 0,
          discount_bps: 0,
          tax_rate_bps: 0,
          line_subtotal_minor: 0,
          line_tax_minor: 0,
          line_total_minor: 0,
        };
      }
    });
  }, [lines, taxRateBpsById]);

  const totals = useMemo(() => totalOfLines(computed), [computed]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }

  function pickProduct(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateLine(key, { product_id: "" });
      return;
    }
    updateLine(key, {
      product_id: product.id,
      description: product.name,
      unit_price: product.default_price.toFixed(2),
      tax_rate_id: product.default_tax_rate_id ?? "",
    });
  }

  async function save() {
    startTransition(async () => {
      const payload = lines.map((l) => ({
        product_id: l.product_id || undefined,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_bps: l.discount_bps,
        tax_rate_id: l.tax_rate_id || undefined,
      }));
      const headerPayload = {
        ...header,
        deal_id: header.deal_id || undefined,
        company_id: header.company_id || undefined,
        contact_id: header.contact_id || undefined,
        valid_until: header.valid_until || undefined,
        notes: header.notes || undefined,
      };
      const r = isEdit
        ? await updateQuote(quote!.id, headerPayload, payload)
        : await createQuote(headerPayload, payload);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isEdit ? "Quote updated" : "Quote created");
      router.push(`/quotes/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quote header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Deal</Label>
            <Select
              value={header.deal_id || NONE}
              onValueChange={(v) => {
                const dealId = v === NONE ? "" : v;
                const deal = deals.find((d) => d.id === dealId);
                setHeader((h) => ({
                  ...h,
                  deal_id: dealId,
                  company_id: deal?.company_id ?? h.company_id,
                  contact_id: deal?.primary_contact_id ?? h.contact_id,
                  currency: deal?.currency ?? h.currency,
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No deal</SelectItem>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Company</Label>
            <Select
              value={header.company_id || NONE}
              onValueChange={(v) =>
                setHeader((h) => ({ ...h, company_id: v === NONE ? "" : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact</Label>
            <Select
              value={header.contact_id || NONE}
              onValueChange={(v) =>
                setHeader((h) => ({ ...h, contact_id: v === NONE ? "" : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {contacts
                  .filter(
                    (c) => !header.company_id || c.company_id === header.company_id
                  )
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Currency</Label>
              <Input
                value={header.currency}
                onChange={(e) =>
                  setHeader((h) => ({ ...h, currency: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Valid until</Label>
              <Input
                type="date"
                value={header.valid_until}
                onChange={(e) =>
                  setHeader((h) => ({ ...h, valid_until: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={header.notes}
              rows={3}
              onChange={(e) =>
                setHeader((h) => ({ ...h, notes: e.target.value }))
              }
              placeholder="Payment terms, delivery timeline, small print…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line items</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, newLine()])}
          >
            <Plus className="size-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div
                key={line.key}
                className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3"
              >
                <div className="col-span-4">
                  <Label className="text-xs">Product / description</Label>
                  <Select
                    value={line.product_id || NONE}
                    onValueChange={(v) =>
                      pickProduct(line.key, v === NONE ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Free-form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Free-form</SelectItem>
                      {products
                        .filter((p) => !p.is_archived)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.key, { description: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Unit price</Label>
                  <Input
                    inputMode="decimal"
                    value={line.unit_price}
                    onChange={(e) =>
                      updateLine(line.key, { unit_price: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Disc %</Label>
                  <Input
                    inputMode="numeric"
                    value={
                      line.discount_bps
                        ? String(parseInt(line.discount_bps, 10) / 100)
                        : "0"
                    }
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value || "0");
                      updateLine(line.key, {
                        discount_bps: String(Math.round(pct * 100)),
                      });
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Tax</Label>
                  <Select
                    value={line.tax_rate_id || NONE}
                    onValueChange={(v) =>
                      updateLine(line.key, {
                        tax_rate_id: v === NONE ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {taxRates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({(t.rate_bps / 100).toFixed(2)}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex flex-col items-end">
                  <Label className="text-xs">Line total</Label>
                  <div className="tabular-nums text-sm font-medium">
                    {formatMinor(
                      computed[i]?.line_total_minor ?? 0,
                      header.currency
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-1 text-sm">
              <Row
                label="Subtotal"
                value={formatMinor(totals.subtotal_minor, header.currency)}
              />
              <Row
                label="Tax"
                value={formatMinor(totals.tax_minor, header.currency)}
              />
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMinor(totals.total_minor, header.currency)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save quote" : "Create quote"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
