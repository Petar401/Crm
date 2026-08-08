import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { LIST_LIMIT } from "@/lib/constants/list";
import type { Invoice, InvoiceFolder } from "@/lib/db/types";
import { INVOICE_BUCKET } from "@/features/invoices/constants";

export interface InvoiceWithUrl extends Invoice {
  signed_url: string | null;
}

/**
 * Signs URLs for a batch of invoices. Takes the caller's Supabase client so we
 * don't re-cross the cookies() barrier for every invoice on a page load.
 */
async function withSignedUrls(
  supabase: SupabaseClient,
  invoices: Invoice[]
): Promise<InvoiceWithUrl[]> {
  if (invoices.length === 0) return [];
  const paths = invoices.map((i) => i.storage_path);
  const { data: signed } = await supabase.storage
    .from(INVOICE_BUCKET)
    .createSignedUrls(paths, 60 * 10);

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
  );

  return invoices.map((i) => ({
    ...i,
    signed_url: urlByPath.get(i.storage_path) ?? null,
  }));
}

/** All invoice folders in a workspace (used to build the tree and breadcrumbs). */
export async function getInvoiceFolders(
  workspaceId: string
): Promise<InvoiceFolder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_folders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })
    .limit(LIST_LIMIT);

  return (data ?? []) as InvoiceFolder[];
}

/** Invoices within a given folder (null = root), newest first. */
export async function getInvoices(
  workspaceId: string,
  folderId: string | null
): Promise<InvoiceWithUrl[]> {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("workspace_id", workspaceId);

  query = folderId
    ? query.eq("folder_id", folderId)
    : query.is("folder_id", null);

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  return withSignedUrls(supabase, (data ?? []) as Invoice[]);
}
