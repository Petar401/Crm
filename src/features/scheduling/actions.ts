"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { notify } from "@/features/notifications/emit";
import {
  bookSlotSchema,
  linkInputSchema,
} from "@/features/scheduling/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Owner-side link CRUD
// ---------------------------------------------------------------------------

export async function createLink(values: unknown): Promise<ActionResult> {
  const parsed = linkInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("scheduling.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduling_links")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_user_id: ctx.userId,
      ...parsed.data,
      description: parsed.data.description || null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };
  revalidatePath("/settings/scheduling");
  return { id: data.id };
}

export async function updateLink(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = linkInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("scheduling.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduling_links")
    .update({
      ...parsed.data,
      description: parsed.data.description || null,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/scheduling");
  return { id };
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("scheduling.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduling_links")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/scheduling");
  return {};
}

// ---------------------------------------------------------------------------
// Public: book a slot (called from /book/[slug], no session)
// ---------------------------------------------------------------------------

export async function bookSlot(values: unknown): Promise<ActionResult> {
  const parsed = bookSlotSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("scheduling_links")
    .select("*")
    .eq("slug", parsed.data.slug)
    .maybeSingle();
  if (!link || !link.is_active) {
    return { error: "This link is no longer active" };
  }

  const start = new Date(parsed.data.start_at);
  const end = new Date(start.getTime() + link.duration_minutes * 60_000);

  // Find or create the contact by email (workspace-scoped).
  let contactId: string | null = null;
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("workspace_id", link.workspace_id)
    .eq("email", parsed.data.invitee_email)
    .maybeSingle<{ id: string }>();
  if (existing) contactId = existing.id;
  else {
    // Need a company_id to satisfy NOT NULL — look up a default or skip.
    const { data: anyCompany } = await admin
      .from("companies")
      .select("id")
      .eq("workspace_id", link.workspace_id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (anyCompany) {
      const [first, ...rest] = parsed.data.invitee_name.split(" ");
      const { data: inserted } = await admin
        .from("contacts")
        .insert({
          workspace_id: link.workspace_id,
          company_id: anyCompany.id,
          first_name: first ?? parsed.data.invitee_name,
          last_name: rest.join(" ") || " ",
          email: parsed.data.invitee_email,
          contact_role: "other",
        })
        .select("id")
        .single<{ id: string }>();
      contactId = inserted?.id ?? null;
    }
  }

  // Create the calendar event owned by the link owner.
  const { data: event, error: evError } = await admin
    .from("calendar_events")
    .insert({
      workspace_id: link.workspace_id,
      owner_user_id: link.owner_user_id,
      title: `${link.title} — ${parsed.data.invitee_name}`,
      description: parsed.data.invitee_notes || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      timezone: link.timezone,
      contact_id: contactId,
      created_by: link.owner_user_id,
    })
    .select("id")
    .single<{ id: string }>();
  if (evError) return { error: evError.message };

  const { data: booking, error: bookError } = await admin
    .from("bookings")
    .insert({
      scheduling_link_id: link.id,
      calendar_event_id: event.id,
      invitee_name: parsed.data.invitee_name,
      invitee_email: parsed.data.invitee_email,
      invitee_notes: parsed.data.invitee_notes || null,
      contact_id: contactId,
    })
    .select("id")
    .single<{ id: string }>();
  if (bookError) return { error: bookError.message };

  await notify({
    workspaceId: link.workspace_id,
    userIds: [link.owner_user_id],
    kind: "booking_created",
    title: `New booking: ${parsed.data.invitee_name}`,
    body: `${parsed.data.invitee_email} · ${start.toISOString()}`,
    url: `/calendar?date=${start.toISOString().slice(0, 10)}`,
    entityType: "booking",
    entityId: booking.id,
    useAdmin: true,
  });

  return { id: booking.id };
}
