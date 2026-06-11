"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { MemberWithProfile } from "@/features/team/queries";
import { PermissionEditor } from "@/features/permissions/components/permission-editor";
import { initialsOf } from "@/lib/utils/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TeamSettingsProps {
  members: MemberWithProfile[];
  ownerUserId: string | null;
  canEdit: boolean;
}

export function TeamSettings({
  members,
  ownerUserId,
  canEdit,
}: TeamSettingsProps) {
  const [selected, setSelected] = useState<MemberWithProfile | null>(null);

  return (
    <>
      <Card>
        <CardContent className="divide-y p-0">
          {members.map((member) => {
            const name =
              member.profile?.full_name || member.profile?.email || "Member";
            const isOwner = member.user_id === ownerUserId;
            return (
              <button
                key={member.id}
                disabled={!canEdit}
                onClick={() => canEdit && setSelected(member)}
                className="hover:bg-muted/50 flex w-full items-center gap-3 p-4 text-left disabled:cursor-default disabled:hover:bg-transparent"
              >
                <Avatar>
                  <AvatarFallback>
                    {initialsOf(member.profile?.full_name || member.profile?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.profile?.email}
                  </p>
                </div>
                {isOwner && <Badge variant="secondary">Owner</Badge>}
                {member.is_full_access ? (
                  <Badge variant="outline">Full access</Badge>
                ) : (
                  <Badge variant="outline">Custom</Badge>
                )}
                {canEdit && (
                  <ChevronRight className="text-muted-foreground size-4" />
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <PermissionEditor
        member={selected}
        isOwner={selected?.user_id === ownerUserId}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </>
  );
}
