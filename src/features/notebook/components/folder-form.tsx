"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { folderSchema, type FolderInput } from "@/features/notebook/schemas";
import {
  createNoteFolder,
  renameNoteFolder,
} from "@/features/notebook/actions";
import type { NoteFolder } from "@/lib/db/types";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface FolderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: NoteFolder;
}

export function FolderForm({ open, onOpenChange, folder }: FolderFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!folder;

  const form = useForm<FolderInput>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: folder?.name ?? "" },
  });

  function onSubmit(values: FolderInput) {
    startTransition(async () => {
      const result = isEdit
        ? await renameNoteFolder(folder!.id, values)
        : await createNoteFolder(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Folder renamed" : "Folder created");
      onOpenChange(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename folder" : "New folder"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change this folder's name."
              : "Group related notes together in a folder."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Research" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save" : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
