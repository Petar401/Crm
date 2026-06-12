import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDueCampaigns } from "@/features/leads/queries";
import { runCampaign } from "@/features/leads/generate";

export const dynamic = "force-dynamic";
// Lead discovery can take a while (external APIs + per-lead AI calls).
export const maxDuration = 300;

/**
 * Scheduled lead discovery. Invoked by Supabase pg_cron (via pg_net) on an
 * hourly schedule; this handler decides which campaigns are actually due based
 * on their frequency and last run. Secured by a shared bearer secret.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await getDueCampaigns();
  const supabase = createAdminClient();

  const results = [];
  for (const campaign of campaigns) {
    const result = await runCampaign(supabase, campaign, campaign.created_by);
    results.push({
      id: campaign.id,
      name: campaign.name,
      count: result.count,
      error: result.error,
    });
  }

  return NextResponse.json({ ran: campaigns.length, results });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
