"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ContactWithCompany } from "@/features/contacts/queries";
import { deleteContact } from "@/features/contacts/actions";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ContactsTableProps {
  contacts: ContactWithCompany[];
  companies: { id: string; name: string }[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function ContactsTable({
  contacts,
  companies,
  canCreate,
  canUpdate,
  canDelete,
}: ContactsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContactWithCompany | null>(null);
  const [deleting, setDeleting] = useState<ContactWithCompany | null>(null);

  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteContact(deleting.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Contact deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {canCreate && companies.length > 0 && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New contact
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description={
            companies.length === 0
              ? "Add a company first, then create contacts."
              : "Contacts you add will appear here."
          }
          action={
            canCreate && companies.length > 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New contact
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {contact.full_name}
                      {contact.is_primary && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.company?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.job_title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem onSelect={() => setEditing(contact)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleting(contact)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canCreate && (
        <ContactForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          companies={companies}
        />
      )}
      {editing && (
        <ContactForm
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          companies={companies}
          contact={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete contact?"
        description={`This will permanently delete ${deleting?.full_name}.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
