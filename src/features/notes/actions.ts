"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";

export interface ActionResult {
  error?: string;
}

const noteSchema = z.object({
  body: z.string().trim().min(1, "Note can't be empty"),
  company_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

export async function createNote(values: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("notes.create");

  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({
    body: parsed.data.body,
    company_id: parsed.data.company_id ?? null,
    contact_id: parsed.data.contact_id ?? null,
    deal_id: parsed.data.deal_id ?? null,
    lead_id: parsed.data.lead_id ?? null,
    workspace_id: ctx.workspace.id,
    created_by: ctx.userId,
  });

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "note",
    title: "Note added",
    detail: parsed.data.body.slice(0, 140),
    companyId: parsed.data.company_id,
    contactId: parsed.data.contact_id,
    dealId: parsed.data.deal_id,
    leadId: parsed.data.lead_id,
  });

  revalidatePath("/", "layout");
  return {};
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("notes.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
