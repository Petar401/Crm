import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT } from "@/lib/constants/list";
import type {
  Product,
  PriceBook,
  PriceBookEntry,
  TaxRate,
} from "@/lib/db/types";

export async function listProducts(
  workspaceId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<Product[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })
    .limit(LIST_LIMIT);
  if (!opts.includeArchived) {
    query = query.eq("is_archived", false);
  }
  const { data } = await query;
  return (data ?? []) as Product[];
}

export async function getProduct(
  workspaceId: string,
  id: string
): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<Product>();
  return data;
}

export async function listPriceBooks(
  workspaceId: string
): Promise<PriceBook[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_books")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  return (data ?? []) as PriceBook[];
}

export async function getDefaultPriceBook(
  workspaceId: string
): Promise<PriceBook | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_books")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .maybeSingle<PriceBook>();
  return data;
}

export async function listPriceBookEntries(
  priceBookId: string
): Promise<PriceBookEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_book_entries")
    .select("*")
    .eq("price_book_id", priceBookId);
  return (data ?? []) as PriceBookEntry[];
}

export async function listTaxRates(workspaceId: string): Promise<TaxRate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  return (data ?? []) as TaxRate[];
}
