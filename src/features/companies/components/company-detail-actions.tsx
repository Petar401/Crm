"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import type { Company } from "@/lib/db/types";
import type { MemberOption } from "@/features/team/queries";
import { companyStatuses } from "@/features/companies/schemas";
import {
  deleteCompany,
  reassignCompany,
  updateCompanyStatus,
} from "@/features/companies/actions";
import { CompanyForm } from "@/features/companies/components/company-form";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  company: Company;
  members: MemberOption[];
  canUpdate: boolean;
  canDelete: boolean;
}

export function CompanyDetailActions({
  company,
  members,
  canUpdate,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ownerName = company.owner_user_id
    ? members.find((m) => m.userId === company.owner_user_id)?.name ??
      "Unknown"
    : "Unassigned";

  function changeStatus(status: string) {
    if (status === company.status) return;
    startTransition(async () => {
      const result = await updateCompanyStatus(company.id, status);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Status updated");
        router.refresh();
      }
    });
  }

  function reassign(ownerUserId: string | null) {
    if (ownerUserId === company.owner_user_id) return;
    startTransition(async () => {
      const result = await reassignCompany(company.id, ownerUserId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Owner updated");
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    const result = await deleteCompany(company.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Company deleted");
      router.push("/companies");
    }
  }

  if (!canUpdate && !canDelete) {
    return <StatusBadge status={company.status} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-1 disabled:opacity-60"
            >
              <StatusBadge status={company.status} />
              <ChevronDown className="text-muted-foreground size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Set status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companyStatuses.map((s) => (
              <DropdownMenuItem
                key={s}
                className="capitalize"
                onSelect={() => changeStatus(s)}
              >
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <StatusBadge status={company.status} />
      )}

      {canUpdate && members.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>
              <UserCog className="size-4" />
              {ownerName}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Assign owner</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => reassign(null)}>
              Unassigned
            </DropdownMenuItem>
            {members.map((m) => (
              <DropdownMenuItem
                key={m.userId}
                onSelect={() => reassign(m.userId)}
              >
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canUpdate && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          Edit
        </Button>
      )}

      {canDelete && (
        <Button size="sm" variant="outline" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      )}

      {canUpdate && (
        <CompanyForm
          open={editing}
          onOpenChange={setEditing}
          company={company}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete company?"
        description={`This will permanently delete ${company.name} and its related records.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
