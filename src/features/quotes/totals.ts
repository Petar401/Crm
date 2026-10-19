import type { QuoteLineInput } from "@/features/quotes/schemas";

export interface ComputedLine {
  quantity: number;
  unit_price_minor: number;
  discount_bps: number;
  tax_rate_bps: number;
  line_subtotal_minor: number;
  line_tax_minor: number;
  line_total_minor: number;
}

export interface ComputedTotals {
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
}

function toMinor(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

function toQty(value: string): number {
  return Math.round(parseFloat(value) * 1000) / 1000;
}

/**
 * Money math on integer minor units so rounding is deterministic.
 * Discount is applied before tax; tax is charged on the post-discount subtotal.
 */
export function computeLine(
  input: QuoteLineInput,
  taxRateBps: number
): ComputedLine {
  const quantity = toQty(input.quantity);
  const unit_price_minor = toMinor(input.unit_price);
  const discount_bps = parseInt(input.discount_bps, 10) || 0;

  const gross = Math.round(quantity * unit_price_minor);
  const discount = Math.round((gross * discount_bps) / 10000);
  const subtotal = gross - discount;
  const tax = Math.round((subtotal * taxRateBps) / 10000);

  return {
    quantity,
    unit_price_minor,
    discount_bps,
    tax_rate_bps: taxRateBps,
    line_subtotal_minor: subtotal,
    line_tax_minor: tax,
    line_total_minor: subtotal + tax,
  };
}

export function totalOfLines(lines: ComputedLine[]): ComputedTotals {
  return lines.reduce<ComputedTotals>(
    (acc, l) => ({
      subtotal_minor: acc.subtotal_minor + l.line_subtotal_minor,
      tax_minor: acc.tax_minor + l.line_tax_minor,
      discount_minor: 0,
      total_minor: acc.total_minor + l.line_total_minor,
    }),
    {
      subtotal_minor: 0,
      tax_minor: 0,
      discount_minor: 0,
      total_minor: 0,
    }
  );
}
