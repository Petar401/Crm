export function formatCurrency(
  value: number | null | undefined,
  currency = "GBP"
): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Money formatter that keeps two decimals — required for invoice, quote and
 * receipt totals where the rounded `formatCurrency` would silently drop
 * pence. Accepts either major units (a `number` in pounds) or minor units
 * via {@link formatMinor}.
 */
export function formatCurrencyPrecise(
  value: number | null | undefined,
  currency = "GBP"
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a minor-unit integer (e.g. pence) as a two-decimal currency string. */
export function formatMinor(
  minor: number | bigint | null | undefined,
  currency = "GBP"
): string {
  if (minor == null) return "—";
  const n = typeof minor === "bigint" ? Number(minor) : minor;
  return formatCurrencyPrecise(n / 100, currency);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * An ISO timestamp as a `<input type="datetime-local">` value in the user's
 * local time ("2026-05-25T09:00"). Slicing the UTC string instead shows the
 * UTC wall time, which then saves back as local — shifting the time by the
 * UTC offset (an hour during BST) on every edit.
 */
export function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
