"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createRole, deleteRole } from "@/features/permissions/actions";
import { ROLE_NAMES, type RoleName } from "@/features/permissions/role-templates";
import type { Role } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface RoleManagerProps {
  roles: Role[];
  canEdit: boolean;
}

export function RoleManager({ roles, canEdit }: RoleManagerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState<RoleName>("Sales Rep");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createRole({ name: name.trim(), templateName });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Role created");
        setOpen(false);
        setName("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteRole(id);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Roles</h3>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New role
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between border-b px-3 py-2 last:border-b-0"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{r.name}</span>
              {r.is_default && (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                  default
                </span>
              )}
            </div>
            {canEdit && !r.is_default && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(r.id)}
                disabled={pending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Name it and pick a template to pre-fill permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Account Executive"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-template">Copy permissions from</Label>
              <select
                id="role-template"
                className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value as RoleName)}
              >
                {ROLE_NAMES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || name.trim().length < 2}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
