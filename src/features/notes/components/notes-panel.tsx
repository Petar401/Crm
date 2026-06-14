"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Note } from "@/lib/db/types";
import { createNote, deleteNote } from "@/features/notes/actions";
import { summarizeText } from "@/features/ai/actions";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { StickyNote } from "lucide-react";

interface NotesPanelProps {
  notes: Note[];
  entity: {
    companyId?: string;
    contactId?: string;
    dealId?: string;
    leadId?: string;
  };
  canCreate: boolean;
  canDelete: boolean;
  aiEnabled: boolean;
}

export function NotesPanel({
  notes,
  entity,
  canCreate,
  canDelete,
  aiEnabled,
}: NotesPanelProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);

  function add() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await createNote({
        body,
        company_id: entity.companyId,
        contact_id: entity.contactId,
        deal_id: entity.dealId,
        lead_id: entity.leadId,
      });
      if (result.error) toast.error(result.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteNote(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  async function summarize(note: Note) {
    setSummarizing(note.id);
    const r = await summarizeText(note.body);
    setSummarizing(null);
    if (r.error) toast.error(r.error);
    else setSummaries((s) => ({ ...s, [note.id]: r.text ?? "" }));
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={pending || !body.trim()}>
              Add note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md border p-3">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              {summaries[note.id] && (
                <p className="text-muted-foreground bg-muted/50 mt-2 rounded p-2 text-xs">
                  <span className="font-medium">AI summary: </span>
                  {summaries[note.id]}
                </p>
              )}
              <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                <span>{formatDateTime(note.created_at)}</span>
                <div className="flex items-center gap-1">
                  {aiEnabled && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={summarizing === note.id}
                      onClick={() => summarize(note)}
                      title="Summarize with AI"
                    >
                      <Sparkles className="size-3.5" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => remove(note.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
