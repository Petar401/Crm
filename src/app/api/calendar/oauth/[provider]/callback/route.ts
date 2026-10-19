import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { configFor } from "@/features/calendar-sync/config";
import {
  exchangeCode,
  packTokens,
} from "@/features/calendar-sync/tokens";
import type { CalendarProvider } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.redirect(new URL("/settings/calendar?error=provider", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=missing_code", req.url)
    );
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("calendar_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", provider)
    .maybeSingle();
  if (!pending || new Date(pending.expires_at) < new Date()) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=state", req.url)
    );
  }

  const config = configFor(provider as CalendarProvider);
  if (!config) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=not_configured", req.url)
    );
  }

  let tokens;
  try {
    tokens = await exchangeCode(config, code);
  } catch (err) {
    console.error("calendar oauth exchange failed", err);
    return NextResponse.redirect(
      new URL("/settings/calendar?error=exchange", req.url)
    );
  }

  // Fetch the account email so the UI can show which mailbox we've linked.
  const email = await fetchAccountEmail(provider, tokens.access_token).catch(
    () => "connected"
  );

  await admin.from("calendar_accounts").upsert(
    {
      user_id: pending.user_id,
      workspace_id: pending.workspace_id,
      provider,
      external_account_email: email,
      external_calendar_id: "primary",
      encrypted_tokens: packTokens(tokens),
    },
    { onConflict: "user_id,provider,external_calendar_id" }
  );

  await admin.from("calendar_oauth_states").delete().eq("state", state);

  return NextResponse.redirect(
    new URL("/settings/calendar?connected=1", req.url)
  );
}

async function fetchAccountEmail(
  provider: string,
  accessToken: string
): Promise<string> {
  if (provider === "google") {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error("userinfo failed");
    const json = (await r.json()) as { email?: string };
    return json.email ?? "connected";
  }
  const r = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("graph me failed");
  const json = (await r.json()) as { mail?: string; userPrincipalName?: string };
  return json.mail ?? json.userPrincipalName ?? "connected";
}
