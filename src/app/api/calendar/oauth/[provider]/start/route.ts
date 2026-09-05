import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { configFor } from "@/features/calendar-sync/config";
import type { CalendarProvider } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  const ctx = await requireAuthContext();
  await requirePermission("calendar.update");

  const config = configFor(provider as CalendarProvider);
  if (!config) {
    return NextResponse.json(
      { error: `${provider} OAuth is not configured on this environment` },
      { status: 501 }
    );
  }

  const state = randomBytes(24).toString("hex");
  const supabase = await createClient();
  await supabase.from("calendar_oauth_states").insert({
    user_id: ctx.userId,
    workspace_id: ctx.workspace.id,
    provider,
    state,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.redirect(authUrl.toString());
}
