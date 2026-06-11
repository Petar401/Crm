"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PERMISSION_GROUPS } from "@/lib/constants/permissions";
import {
  loadMemberPermissionState,
  saveMemberPermissions,
} from "@/features/permissions/actions";
import type { MemberWithProfile } from "@/features/team/queries";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface PermissionEditorProps {
  member: MemberWithProfile | null;
  isOwner: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionEditor({
  member,
  isOwner,
  onOpenChange,
}: PermissionEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [fullAccess, setFullAccess] = useState(true);
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  const loading = !!member && loadedFor !== member.id;

  useEffect(() => {
    if (!member) return;
    let active = true;
    loadMemberPermissionState(member.id).then((state) => {
      if (!active) return;
      if (state) {
        setFullAccess(state.isFullAccess);
        setPerms(state.effective);
      }
      setLoadedFor(member.id);
    });
    return () => {
      active = false;
    };
  }, [member]);

  function toggle(key: string, value: boolean) {
    setPerms((p) => ({ ...p, [key]: value }));
  }

  function save() {
    if (!member) return;
    startTransition(async () => {
      const result = await saveMemberPermissions({
        memberId: member.id,
        isFullAccess: fullAccess,
        permissions: perms,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Permissions saved");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  const name =
    member?.profile?.full_name || member?.profile?.email || "Member";

  return (
    <Sheet open={!!member} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            {member?.profile?.email}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm font-medium">Full access</Label>
                  <p className="text-muted-foreground text-xs">
                    Can do everything in the workspace.
                  </p>
                </div>
                <Switch
                  checked={fullAccess}
                  disabled={isOwner}
                  onCheckedChange={setFullAccess}
                />
              </div>

              {isOwner && (
                <p className="text-muted-foreground text-xs">
                  The workspace owner always has full access.
                </p>
              )}

              {!fullAccess && (
                <div className="space-y-5">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-sm font-medium">{group.label}</p>
                      <div className="space-y-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={perms[perm.key] ?? false}
                              onCheckedChange={(c) => toggle(perm.key, !!c)}
                            />
                            {perm.description}
                          </label>
                        ))}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={pending || loading || isOwner}>
            {pending ? "Saving…" : "Save permissions"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
