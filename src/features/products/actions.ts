"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import {
  productSchema,
  priceBookSchema,
  priceBookEntrySchema,
  taxRateSchema,
} from "@/features/products/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

function priceToNumber(v: string): number {
  return Math.round(parseFloat(v) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(values: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.create");

  const supabase = await createClient();
  const {
    sku,
    description,
    recurring_interval,
    default_tax_rate_id,
    default_price,
    default_currency,
    ...rest
  } = parsed.data;

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...rest,
      sku: sku || null,
      description: description || null,
      recurring_interval:
        rest.kind === "recurring" ? recurring_interval || null : null,
      default_tax_rate_id: default_tax_rate_id || null,
      default_price: priceToNumber(default_price),
      default_currency: default_currency.toUpperCase(),
      workspace_id: ctx.workspace.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };
  revalidatePath("/products");
  return { id: data.id };
}

export async function updateProduct(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.update");

  const supabase = await createClient();
  const {
    sku,
    description,
    recurring_interval,
    default_tax_rate_id,
    default_price,
    default_currency,
    ...rest
  } = parsed.data;

  const { error } = await supabase
    .from("products")
    .update({
      ...rest,
      sku: sku || null,
      description: description || null,
      recurring_interval:
        rest.kind === "recurring" ? recurring_interval || null : null,
      default_tax_rate_id: default_tax_rate_id || null,
      default_price: priceToNumber(default_price),
      default_currency: default_currency.toUpperCase(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { id };
}

export async function archiveProduct(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("products.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { id };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("products.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return {};
}

// ---------------------------------------------------------------------------
// Price books
// ---------------------------------------------------------------------------

export async function createPriceBook(
  values: unknown
): Promise<ActionResult> {
  const parsed = priceBookSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.create");
  const supabase = await createClient();

  if (parsed.data.is_default) {
    await supabase
      .from("price_books")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspace.id)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("price_books")
    .insert({
      name: parsed.data.name,
      currency: parsed.data.currency.toUpperCase(),
      is_default: parsed.data.is_default,
      workspace_id: ctx.workspace.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return { id: data.id };
}

export async function updatePriceBook(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = priceBookSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.update");
  const supabase = await createClient();

  if (parsed.data.is_default) {
    await supabase
      .from("price_books")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspace.id)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("price_books")
    .update({
      name: parsed.data.name,
      currency: parsed.data.currency.toUpperCase(),
      is_default: parsed.data.is_default,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return { id };
}

export async function deletePriceBook(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("products.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_books")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return {};
}

/**
 * `price_book_entries` has no workspace_id of its own, so confirm the parent
 * price book (and product) belong to the active workspace before writing.
 * RLS enforces the same through `price_books`; this keeps the app layer from
 * relying on it alone (e.g. for a member of several workspaces).
 */
async function priceBookInWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  priceBookId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("price_books")
    .select("id")
    .eq("id", priceBookId)
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}

export async function setPriceBookEntry(
  priceBookId: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = priceBookEntrySchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.update");
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", parsed.data.product_id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ id: string }>();
  if (
    !product ||
    !(await priceBookInWorkspace(supabase, ctx.workspace.id, priceBookId))
  ) {
    return { error: "Price book or product not found." };
  }
  const { error } = await supabase
    .from("price_book_entries")
    .upsert(
      {
        price_book_id: priceBookId,
        product_id: parsed.data.product_id,
        unit_price: priceToNumber(parsed.data.unit_price),
      },
      { onConflict: "price_book_id,product_id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return {};
}

export async function deletePriceBookEntry(
  id: string
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("products.update");
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("price_book_entries")
    .select("price_book_id")
    .eq("id", id)
    .maybeSingle<{ price_book_id: string }>();
  if (
    !entry ||
    !(await priceBookInWorkspace(supabase, ctx.workspace.id, entry.price_book_id))
  ) {
    return { error: "Price book entry not found." };
  }
  const { error } = await supabase
    .from("price_book_entries")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return {};
}

// ---------------------------------------------------------------------------
// Tax rates
// ---------------------------------------------------------------------------

export async function createTaxRate(values: unknown): Promise<ActionResult> {
  const parsed = taxRateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.create");
  const supabase = await createClient();

  if (parsed.data.is_default) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspace.id)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("tax_rates")
    .insert({
      name: parsed.data.name,
      rate_bps: parseInt(parsed.data.rate_bps, 10),
      region: parsed.data.region || null,
      is_default: parsed.data.is_default,
      workspace_id: ctx.workspace.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return { id: data.id };
}

export async function updateTaxRate(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = taxRateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("products.update");
  const supabase = await createClient();

  if (parsed.data.is_default) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspace.id)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("tax_rates")
    .update({
      name: parsed.data.name,
      rate_bps: parseInt(parsed.data.rate_bps, 10),
      region: parsed.data.region || null,
      is_default: parsed.data.is_default,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return { id };
}

export async function deleteTaxRate(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("products.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_rates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/pricing");
  return {};
}
