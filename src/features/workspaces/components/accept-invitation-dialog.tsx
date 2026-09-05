"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { acceptInvitationAction } from "@/features/workspaces/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AcceptInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AcceptInvitationDialog({
  open,
  onOpenChange,
}: AcceptInvitationDialogProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!token.trim()) return;
    startTransition(async () => {
      const res = await acceptInvitationAction(token.trim());
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Joined workspace");
        onOpenChange(false);
        setToken("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept invitation</DialogTitle>
          <DialogDescription>
            Paste the invitation token or link from your invite email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="invite-token">Invitation token</Label>
          <Input
            id="invite-token"
            value={token}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const match = raw.match(/\/invite\/([^/?#]+)/);
              setToken(match ? match[1] : raw);
            }}
            placeholder="paste token or URL"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !token.trim()}>
            {pending ? "Joining…" : "Join workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
