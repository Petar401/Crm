import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIST_LIMIT } from "@/lib/constants/list";
import { sha256Hex } from "@/features/quotes/token";
import type {
  Company,
  Contact,
  Deal,
  Quote,
  QuoteLine,
} from "@/lib/db/types";

export interface QuoteListItem extends Quote {
  deal?: Pick<Deal, "id" | "name"> | null;
  company?: Pick<Company, "id" | "name"> | null;
}

export async function listQuotes(
  workspaceId: string,
  opts: { dealId?: string; companyId?: string } = {}
): Promise<QuoteListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("*, deal:deals(id,name), company:companies(id,name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (opts.dealId) query = query.eq("deal_id", opts.dealId);
  if (opts.companyId) query = query.eq("company_id", opts.companyId);
  const { data } = await query;
  return (data ?? []) as QuoteListItem[];
}

export async function getQuote(
  workspaceId: string,
  id: string
): Promise<Quote | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle<Quote>();
  return data;
}

export async function getQuoteLines(quoteId: string): Promise<QuoteLine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_lines")
    .select("*")
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });
  return (data ?? []) as QuoteLine[];
}

export interface QuoteBundle {
  quote: Quote;
  lines: QuoteLine[];
  company: Pick<Company, "id" | "name" | "email" | "address_line_1" | "city" | "postcode" | "country"> | null;
  contact: Pick<Contact, "id" | "full_name" | "email"> | null;
}

/**
 * Public-share resolver. Bypasses RLS via the admin client because the
 * caller isn't authenticated. Returns null when the token is unknown,
 * revoked or expired.
 */
export async function resolveShareToken(token: string): Promise<QuoteBundle | null> {
  const hash = sha256Hex(token);
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("quote_share_tokens")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!share || share.revoked_at) return null;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", share.quote_id)
    .maybeSingle<Quote>();
  if (!quote) return null;

  const { data: lines } = await admin
    .from("quote_lines")
    .select("*")
    .eq("quote_id", quote.id)
    .order("position", { ascending: true });

  const [{ data: company }, { data: contact }] = await Promise.all([
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
    quote,
    lines: (lines ?? []) as QuoteLine[],
    company: (company ?? null) as QuoteBundle["company"],
    contact: (contact ?? null) as QuoteBundle["contact"],
  };
}
