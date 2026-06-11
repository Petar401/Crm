"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderPlus,
  Layers,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { NoteFolder, NotebookNote } from "@/lib/db/types";
import {
  deleteNotebookNote,
  deleteNoteFolder,
} from "@/features/notebook/actions";
import { NoteForm } from "@/features/notebook/components/note-form";
import { FolderForm } from "@/features/notebook/components/folder-form";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Sentinel scopes for the folder rail selection. */
const ALL = "all";
const UNFILED = "unfiled";

interface NotebookViewProps {
  folders: NoteFolder[];
  notes: NotebookNote[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function NotebookView({
  folders,
  notes,
  canCreate,
  canUpdate,
  canDelete,
}: NotebookViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NotebookNote | null>(null);
  const [viewingNote, setViewingNote] = useState<NotebookNote | null>(null);
  const [deletingNote, setDeletingNote] = useState<NotebookNote | null>(null);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<NoteFolder | null>(null);

  const folderName = useMemo(() => {
    const map = new Map(folders.map((f) => [f.id, f.name]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [folders]);

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    let unfiled = 0;
    for (const note of notes) {
      if (note.folder_id) {
        byFolder.set(note.folder_id, (byFolder.get(note.folder_id) ?? 0) + 1);
      } else {
        unfiled += 1;
      }
    }
    return { byFolder, unfiled };
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((note) => {
      const inScope =
        selected === ALL
          ? true
          : selected === UNFILED
            ? note.folder_id === null
            : note.folder_id === selected;
      if (!inScope) return false;
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q)
      );
    });
  }, [notes, selected, search]);

  async function handleDeleteNote() {
    if (!deletingNote) return;
    const result = await deleteNotebookNote(deletingNote.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Note deleted");
      router.refresh();
    }
  }

  async function handleDeleteFolder() {
    if (!deletingFolder) return;
    const result = await deleteNoteFolder(deletingFolder.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Folder deleted");
      if (selected === deletingFolder.id) setSelected(ALL);
      router.refresh();
    }
  }

  const defaultFolderId =
    selected === ALL || selected === UNFILED ? null : selected;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Folder rail */}
      <aside className="md:w-56 md:shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Folders
          </span>
          {canCreate && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCreateFolderOpen(true)}
              title="New folder"
            >
              <FolderPlus className="size-4" />
            </Button>
          )}
        </div>
        <nav className="space-y-1">
          <FolderRailItem
            icon={Layers}
            label="All notes"
            count={notes.length}
            active={selected === ALL}
            onClick={() => setSelected(ALL)}
          />
          <FolderRailItem
            icon={NotebookPen}
            label="Unfiled"
            count={counts.unfiled}
            active={selected === UNFILED}
            onClick={() => setSelected(UNFILED)}
          />
          {folders.map((folder) => (
            <FolderRailItem
              key={folder.id}
              icon={Folder}
              label={folder.name}
              count={counts.byFolder.get(folder.id) ?? 0}
              active={selected === folder.id}
              onClick={() => setSelected(folder.id)}
              menu={
                (canUpdate || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdate && (
                        <DropdownMenuItem
                          onSelect={() => setEditingFolder(folder)}
                        >
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeletingFolder(folder)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
            />
          ))}
        </nav>
      </aside>

      {/* Notes */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {canCreate && (
            <Button onClick={() => setCreateNoteOpen(true)}>
              <Plus className="size-4" />
              New note
            </Button>
          )}
        </div>

        {visibleNotes.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title={search ? "No matching notes" : "No notes yet"}
            description={
              search
                ? "Try a different search."
                : "Notes you write will be shared with your team and appear here."
            }
            action={
              canCreate && !search ? (
                <Button onClick={() => setCreateNoteOpen(true)}>
                  <Plus className="size-4" />
                  New note
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setViewingNote(note)}
                className="hover:border-foreground/20 hover:bg-muted/40 flex h-full flex-col rounded-lg border p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-sm font-medium">
                    {note.title}
                  </h3>
                  {(canUpdate || canDelete) && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-1 -mt-1 size-7 shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem
                              onSelect={() => setEditingNote(note)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeletingNote(note)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-4 flex-1 whitespace-pre-wrap text-xs">
                  {note.body || "No content"}
                </p>
                <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                  {note.folder_id && (
                    <span className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5">
                      <Folder className="size-3" />
                      {folderName(note.folder_id) ?? "Folder"}
                    </span>
                  )}
                  <span className="ml-auto">
                    {formatDateTime(note.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note viewer */}
      <Sheet
        open={!!viewingNote}
        onOpenChange={(o) => !o && setViewingNote(null)}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{viewingNote?.title}</SheetTitle>
            <SheetDescription>
              {folderName(viewingNote?.folder_id ?? null) ?? "Unfiled"} ·
              Updated {formatDateTime(viewingNote?.updated_at)}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <p className="whitespace-pre-wrap text-sm">
              {viewingNote?.body || "No content"}
            </p>
            {(canUpdate || canDelete) && (
              <div className="mt-6 flex gap-2">
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingNote(viewingNote);
                      setViewingNote(null);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingNote(viewingNote);
                      setViewingNote(null);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs & forms */}
      {canCreate && (
        <NoteForm
          open={createNoteOpen}
          onOpenChange={setCreateNoteOpen}
          folders={folders}
          defaultFolderId={defaultFolderId}
        />
      )}
      {editingNote && (
        <NoteForm
          open={!!editingNote}
          onOpenChange={(o) => !o && setEditingNote(null)}
          folders={folders}
          note={editingNote}
        />
      )}
      {canCreate && (
        <FolderForm open={createFolderOpen} onOpenChange={setCreateFolderOpen} />
      )}
      {editingFolder && (
        <FolderForm
          open={!!editingFolder}
          onOpenChange={(o) => !o && setEditingFolder(null)}
          folder={editingFolder}
        />
      )}
      <ConfirmDialog
        open={!!deletingNote}
        onOpenChange={(o) => !o && setDeletingNote(null)}
        title="Delete note?"
        description={`This will permanently delete "${deletingNote?.title}".`}
        onConfirm={handleDeleteNote}
      />
      <ConfirmDialog
        open={!!deletingFolder}
        onOpenChange={(o) => !o && setDeletingFolder(null)}
        title="Delete folder?"
        description={`This deletes "${deletingFolder?.name}". Notes inside it are kept and moved to Unfiled.`}
        onConfirm={handleDeleteFolder}
      />
    </div>
  );
}

function FolderRailItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  menu,
}: {
  icon: typeof Folder;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  menu?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-muted font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {menu ? (
        <span className="opacity-0 group-hover:opacity-100">{menu}</span>
      ) : null}
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
    </div>
  );
}
