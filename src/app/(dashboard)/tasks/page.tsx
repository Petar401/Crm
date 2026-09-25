import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getTasks } from "@/features/tasks/queries";
import { getMemberOptions } from "@/features/team/queries";
import { getCompanyOptions } from "@/features/contacts/queries";
import { getBankHolidays } from "@/features/tools/bank-holidays";
import { TasksList } from "@/features/tasks/components/tasks-list";
import { ExportMenu } from "@/features/tools/components/export-menu";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("tasks.view")) redirect("/");

  const [tasks, members, companies, bankHolidayList] = await Promise.all([
    getTasks(ctx.workspace.id),
    getMemberOptions(ctx.workspace.id),
    getCompanyOptions(ctx.workspace.id),
    getBankHolidays().catch(() => null),
  ]);
  const bankHolidays = (bankHolidayList ?? []).map(({ date, title }) => ({ date, title }));

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Your team's to-do list"
        action={<ExportMenu entity="tasks" calendar myCalendar />}
      />
      <TasksList
        tasks={tasks}
        members={members}
        companies={companies}
        canCreate={allowed.has("tasks.create")}
        canUpdate={allowed.has("tasks.update")}
        canDelete={allowed.has("tasks.delete")}
        bankHolidays={bankHolidays}
      />
    </div>
  );
}
