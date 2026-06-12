import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { taskAssignedTemplate, crmCreatedTemplate } from "@/lib/email/templates";

async function getWorkspaceMemberEmails(
  workspaceId: string,
  excludeUserId: string
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("profile:profiles(email)")
    .eq("workspace_id", workspaceId)
    .neq("user_id", excludeUserId);

  if (!data) return [];
  return (data as unknown as { profile: { email: string } | null }[])
    .map((m) => m.profile?.email)
    .filter((e): e is string => !!e);
}

async function getProfileEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single<{ email: string }>();
  return data?.email ?? null;
}

export async function notifyTaskCreated(opts: {
  workspaceId: string;
  creatorUserId: string;
  creatorName: string;
  taskTitle: string;
  assignedToUserId: string | null;
  workspaceName: string;
  priority?: string;
  dueAt?: string | null;
}): Promise<void> {
  if (opts.assignedToUserId && opts.assignedToUserId !== opts.creatorUserId) {
    const email = await getProfileEmail(opts.assignedToUserId);
    if (!email) return;
    await sendEmail({
      to: [email],
      subject: `Task assigned to you: ${opts.taskTitle}`,
      html: taskAssignedTemplate({
        taskTitle: opts.taskTitle,
        actorName: opts.creatorName,
        workspaceName: opts.workspaceName,
        priority: opts.priority,
        dueAt: opts.dueAt,
      }),
    });
  } else if (!opts.assignedToUserId) {
    const emails = await getWorkspaceMemberEmails(opts.workspaceId, opts.creatorUserId);
    if (emails.length === 0) return;
    await sendEmail({
      to: emails,
      subject: `New task: ${opts.taskTitle}`,
      html: crmCreatedTemplate({
        entityType: "task",
        entityTitle: opts.taskTitle,
        actorName: opts.creatorName,
        workspaceName: opts.workspaceName,
      }),
    });
  }
}

export async function notifyWorkspaceEvent(opts: {
  workspaceId: string;
  creatorUserId: string;
  creatorName: string;
  entityType: string;
  entityTitle: string;
  workspaceName: string;
}): Promise<void> {
  const emails = await getWorkspaceMemberEmails(opts.workspaceId, opts.creatorUserId);
  if (emails.length === 0) return;
  await sendEmail({
    to: emails,
    subject: `New ${opts.entityType}: ${opts.entityTitle}`,
    html: crmCreatedTemplate({
      entityType: opts.entityType,
      entityTitle: opts.entityTitle,
      actorName: opts.creatorName,
      workspaceName: opts.workspaceName,
    }),
  });
}
