"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { eventInputSchema } from "@/features/calendar/schemas";

export interface ActionResult {
  error?: string;
  id?: string;
}

export async function createEvent(values: unknown): Promise<ActionResult> {
  const parsed = eventInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("calendar.create");
  const supabase = await createClient();

  const { attendees, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_user_id: ctx.userId,
      title: rest.title,
      description: rest.description || null,
      location: rest.location || null,
      start_at: rest.start_at,
      end_at: rest.end_at,
      all_day: rest.all_day,
      timezone: rest.timezone || ctx.workspace.timezone,
      deal_id: rest.deal_id || null,
      company_id: rest.company_id || null,
      contact_id: rest.contact_id || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  if (attendees && attendees.length > 0) {
    await supabase.from("calendar_event_attendees").insert(
      attendees.map((a) => ({
        event_id: data.id,
        email: a.email,
        name: a.name || null,
        contact_id: a.contact_id || null,
      }))
    );
  }

  revalidatePath("/calendar");
  return { id: data.id };
}

export async function updateEvent(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = eventInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ctx = await requireAuthContext();
  await requirePermission("calendar.update");
  const supabase = await createClient();

  const { attendees, ...rest } = parsed.data;

  const { error } = await supabase
    .from("calendar_events")
    .update({
      title: rest.title,
      description: rest.description || null,
      location: rest.location || null,
      start_at: rest.start_at,
      end_at: rest.end_at,
      all_day: rest.all_day,
      timezone: rest.timezone || ctx.workspace.timezone,
      deal_id: rest.deal_id || null,
      company_id: rest.company_id || null,
      contact_id: rest.contact_id || null,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };

  if (attendees) {
    await supabase.from("calendar_event_attendees").delete().eq("event_id", id);
    if (attendees.length > 0) {
      await supabase.from("calendar_event_attendees").insert(
        attendees.map((a) => ({
          event_id: id,
          email: a.email,
          name: a.name || null,
          contact_id: a.contact_id || null,
        }))
      );
    }
  }

  revalidatePath("/calendar");
  return { id };
}

export async function cancelEvent(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("calendar.update");
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { id };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("calendar.delete");
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return {};
}
