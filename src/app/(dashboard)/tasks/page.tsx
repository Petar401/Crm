import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getTasks } from "@/features/tasks/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { TasksList } from "@/features/tasks/components/tasks-list";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("tasks.view")) redirect("/");

  const [tasks, members, companies] = await Promise.all([
    getTasks(ctx.workspace.id),
    getMemberOptions(ctx.workspace.id),
    getCompanyOptions(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader title="Tasks" description="Your team's to-do list" />
      <TasksList
        tasks={tasks}
        members={members}
        companies={companies}
        canCreate={allowed.has("tasks.create")}
        canUpdate={allowed.has("tasks.update")}
        canDelete={allowed.has("tasks.delete")}
      />
    </div>
  );
}
