"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { logActivity } from "@/features/activities/log";
import { taskSchema, type TaskInput } from "@/features/tasks/schemas";
import { notifyTaskCreated } from "@/lib/notifications";

export interface ActionResult {
  error?: string;
  id?: string;
}

function toRow(data: TaskInput) {
  const emptyToNull = (v: string | undefined) => (v && v !== "" ? v : null);
  return {
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    priority: data.priority,
    due_at: emptyToNull(data.due_at),
    assigned_to: emptyToNull(data.assigned_to),
    company_id: emptyToNull(data.company_id),
    deal_id: emptyToNull(data.deal_id),
  };
}

export async function createTask(values: unknown): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("tasks.create");

  const supabase = await createClient();
  const row = toRow(parsed.data);
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...row,
      workspace_id: ctx.workspace.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    type: "task_created",
    title: `Task created: ${parsed.data.title}`,
    companyId: row.company_id,
    dealId: row.deal_id,
    taskId: data.id,
  });

  notifyTaskCreated({
    workspaceId: ctx.workspace.id,
    creatorUserId: ctx.userId,
    creatorName: ctx.profile?.full_name ?? ctx.email,
    taskTitle: parsed.data.title,
    assignedToUserId: row.assigned_to,
    workspaceName: ctx.workspace.name,
    priority: parsed.data.priority,
    dueAt: row.due_at,
  }).catch(() => {});

  revalidatePath("/tasks");
  return { id: data.id };
}

export async function updateTask(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireAuthContext();
  await requirePermission("tasks.update");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { id };
}

/** Quick status toggle from the list (checkbox). */
export async function setTaskStatus(
  id: string,
  status: TaskInput["status"]
): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("tasks.update");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .select("title, company_id, deal_id")
    .single<{ title: string; company_id: string | null; deal_id: string | null }>();

  if (error) return { error: error.message };

  if (status === "done") {
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.userId,
      type: "task_completed",
      title: `Task completed: ${data.title}`,
      companyId: data.company_id,
      dealId: data.deal_id,
      taskId: id,
    });
  }

  revalidatePath("/tasks");
  return { id };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  await requirePermission("tasks.delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return {};
}
