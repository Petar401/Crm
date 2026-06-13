"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { TaskWithRelations } from "@/features/tasks/queries";
import type { MemberOption } from "@/features/team/queries";
import { deleteTask, setTaskStatus } from "@/features/tasks/actions";
import { TaskForm } from "@/features/tasks/components/task-form";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataToolbar, useDataView } from "@/components/shared/data-toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TasksListProps {
  tasks: TaskWithRelations[];
  members: MemberOption[];
  companies: { id: string; name: string }[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function TasksList({
  tasks,
  members,
  companies,
  canCreate,
  canUpdate,
  canDelete,
}: TasksListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TaskWithRelations | null>(null);

  const priorityRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const dv = useDataView<TaskWithRelations>({
    data: tasks,
    searchPlaceholder: "Search tasks…",
    searchAccessor: (t) => [t.title, t.company?.name, t.assignee?.full_name],
    filters: [
      {
        id: "status",
        label: "All statuses",
        accessor: (t) => t.status,
        options: [
          { value: "todo", label: "To do" },
          { value: "in_progress", label: "In progress" },
          { value: "done", label: "Done" },
          { value: "cancelled", label: "Cancelled" },
        ],
      },
      {
        id: "priority",
        label: "All priorities",
        accessor: (t) => t.priority,
        options: [
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
      {
        id: "assignee",
        label: "All assignees",
        accessor: (t) => t.assigned_to,
        options: members.map((m) => ({ value: m.userId, label: m.name })),
      },
    ],
    sorts: [
      {
        id: "due_at",
        label: "Due date",
        accessor: (t) => t.due_at,
        type: "date",
      },
      {
        id: "priority",
        label: "Priority",
        accessor: (t) => priorityRank[t.priority],
        type: "number",
      },
      { id: "title", label: "Title", accessor: (t) => t.title, type: "text" },
      {
        id: "created_at",
        label: "Date created",
        accessor: (t) => t.created_at,
        type: "date",
      },
    ],
    defaultSortId: "due_at",
    defaultSortDir: "asc",
  });
  const filtered = dv.view;

  async function toggle(task: TaskWithRelations, checked: boolean) {
    if (!canUpdate) return;
    const result = await setTaskStatus(task.id, checked ? "done" : "todo");
    if (result.error) toast.error(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteTask(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Task deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <DataToolbar controller={dv}>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New task
          </Button>
        )}
      </DataToolbar>

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Tasks you create will appear here."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New task
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No matches"
          description="No tasks match your search and filters."
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((task) => {
            const done = task.status === "done";
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3"
              >
                <Checkbox
                  checked={done}
                  disabled={!canUpdate}
                  onCheckedChange={(c) => toggle(task, !!c)}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      done ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    {task.due_at && <span>{formatDateTime(task.due_at)}</span>}
                    {task.assignee?.full_name && (
                      <span>· {task.assignee.full_name}</span>
                    )}
                    {task.company?.name && <span>· {task.company.name}</span>}
                  </div>
                </div>
                <StatusBadge status={task.priority} />
                <StatusBadge status={task.status} />
                {(canUpdate || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdate && (
                        <DropdownMenuItem onSelect={() => setEditing(task)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleting(task)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canCreate && (
        <TaskForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          members={members}
          companies={companies}
        />
      )}
      {editing && (
        <TaskForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          members={members}
          companies={companies}
          task={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete task?"
        description={`This will permanently delete "${deleting?.title}".`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
