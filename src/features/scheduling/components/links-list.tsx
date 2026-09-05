"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { SchedulingLink } from "@/lib/db/types";
import { deleteLink } from "@/features/scheduling/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LinkEditor } from "@/features/scheduling/components/link-editor";

interface Props {
  links: SchedulingLink[];
  canManage: boolean;
  publicBaseUrl: string;
  userTimezone: string;
}

export function LinksList({
  links,
  canManage,
  publicBaseUrl,
  userTimezone,
}: Props) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SchedulingLink | null>(null);
  const [deleting, setDeleting] = useState<SchedulingLink | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    const r = await deleteLink(deleting.id);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Link removed");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          People can pick a slot at{" "}
          <span className="font-mono">{publicBaseUrl}/book/&lt;slug&gt;</span>.
        </p>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="size-4" />
            New link
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No booking links yet"
          description="Create one so people can book time with you without back-and-forth email."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {links.map((l) => {
            const url = `${publicBaseUrl}/book/${l.slug}`;
            return (
              <Card key={l.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {l.title}
                      {!l.is_active && (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">
                      {l.duration_minutes} min · {l.timezone}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(l);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(l)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {l.description && (
                    <p className="text-muted-foreground text-sm">
                      {l.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 truncate rounded px-2 py-1 text-xs">
                      {url}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <LinkEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          link={editing ?? undefined}
          userTimezone={userTimezone}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove booking link?"
        description={`This will disable ${publicBaseUrl}/book/${deleting?.slug ?? ""}. Existing bookings stay in the calendar.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
