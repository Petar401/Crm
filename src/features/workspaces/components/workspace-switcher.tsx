"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Check, Plus, MailPlus, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { setActiveWorkspaceAction } from "@/features/workspaces/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AcceptInvitationDialog } from "@/features/workspaces/components/accept-invitation-dialog";

export interface WorkspaceSwitcherItem {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSwitcherItem[];
  activeId: string;
}

export function WorkspaceSwitcher({ workspaces, activeId }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);

  const active = workspaces.find((w) => w.id === activeId);

  function switchTo(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const res = await setActiveWorkspaceAction(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Switched workspace");
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 px-2 font-semibold"
            disabled={pending}
          >
            <Building2 className="size-4" />
            <span className="max-w-[16ch] truncate">
              {active?.name ?? "Workspace"}
            </span>
            <ChevronsUpDown className="text-muted-foreground size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => switchTo(w.id)}
              className="justify-between"
            >
              <span className="truncate">{w.name}</span>
              {w.id === activeId ? (
                <Check className="size-4" />
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/onboarding?new=1")}>
            <Plus className="size-4" />
            Create workspace
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
            <MailPlus className="size-4" />
            Accept invitation…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AcceptInvitationDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
