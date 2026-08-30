import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalise a website to a bare hostname for dedupe comparisons. Shared
 * between the OSM (generate.ts) and Apollo (apollo/campaign-run.ts) campaign
 * runners so both dedupe against existing companies the same way.
 */
export function normalizeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").toLowerCase();
  }
}

/** Records the outcome of a campaign run for display in the campaigns list. */
export async function markCampaignRun(
  supabase: SupabaseClient,
  campaignId: string,
  status: string,
  count: number
): Promise<void> {
  await supabase
    .from("lead_campaigns")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_count: count,
    })
    .eq("id", campaignId);
}
