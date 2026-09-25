"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteMember } from "@/features/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InviteMemberDialog({
  canGrantFullAccess = false,
}: {
  /** Whether the inviter holds `team.edit_roles` (shows the full-access switch). */
  canGrantFullAccess?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullAccess, setFullAccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteMember({
        email,
        fullAccess: canGrantFullAccess && fullAccess,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Member added");
      setEmail("");
      setFullAccess(false);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They&apos;ll get the workspace&apos;s default role, which you can
              change later in their permissions. If they don&apos;t have an account
              yet, an invite email is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
            {canGrantFullAccess && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <Label htmlFor="invite-full-access" className="font-normal">
                  Give full access (bypass role permissions)
                </Label>
                <Switch
                  id="invite-full-access"
                  checked={fullAccess}
                  onCheckedChange={setFullAccess}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !email}>
              {pending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
