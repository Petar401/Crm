"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { noteSchema, type NoteInput } from "@/features/notebook/schemas";
import {
  createNotebookNote,
  updateNotebookNote,
} from "@/features/notebook/actions";
import type { NoteFolder, NotebookNote } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel select value for "no folder" (Select items must be non-empty). */
const NO_FOLDER = "none";

interface NoteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: NoteFolder[];
  note?: NotebookNote;
  /** Pre-selected folder when creating from within a folder. */
  defaultFolderId?: string | null;
}

export function NoteForm({
  open,
  onOpenChange,
  folders,
  note,
  defaultFolderId,
}: NoteFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!note;

  const form = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: note?.title ?? "",
      body: note?.body ?? "",
      folder_id: note?.folder_id ?? defaultFolderId ?? "",
    },
  });

  function onSubmit(values: NoteInput) {
    const payload = {
      ...values,
      folder_id: values.folder_id === NO_FOLDER ? "" : values.folder_id,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateNotebookNote(note!.id, payload)
        : await createNotebookNote(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Note updated" : "Note created");
      onOpenChange(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit note" : "New note"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this shared note."
              : "Write a note to share with your team."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Research summary…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="folder_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || NO_FOLDER}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your note…"
                      rows={12}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create note"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
