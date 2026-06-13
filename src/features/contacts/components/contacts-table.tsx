"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ContactWithCompany } from "@/features/contacts/queries";
import { deleteContact } from "@/features/contacts/actions";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataToolbar, useDataView } from "@/components/shared/data-toolbar";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContactWithCompany | null>(null);
  const [deleting, setDeleting] = useState<ContactWithCompany | null>(null);

  const dv = useDataView<ContactWithCompany>({
    data: contacts,
    searchPlaceholder: "Search contacts…",
    searchAccessor: (c) => [c.full_name, c.email, c.job_title, c.company?.name],
    filters: [
      {
        id: "role",
        label: "All roles",
        accessor: (c) => c.contact_role,
        options: [
          { value: "decision_maker", label: "Decision maker" },
          { value: "influencer", label: "Influencer" },
          { value: "admin", label: "Admin" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "company",
        label: "All companies",
        accessor: (c) => c.company_id,
        options: companies.map((co) => ({ value: co.id, label: co.name })),
      },
    ],
    sorts: [
      {
        id: "full_name",
        label: "Name",
        accessor: (c) => c.full_name,
        type: "text",
      },
      {
        id: "company",
        label: "Company",
        accessor: (c) => c.company?.name,
        type: "text",
      },
      {
        id: "job_title",
        label: "Title",
        accessor: (c) => c.job_title,
        type: "text",
      },
      {
        id: "created_at",
        label: "Date added",
        accessor: (c) => c.created_at,
        type: "date",
      },
    ],
    defaultSortId: "full_name",
    defaultSortDir: "asc",
  });
  const filtered = dv.view;

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
      <DataToolbar controller={dv}>
        {canCreate && companies.length > 0 && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New contact
          </Button>
        )}
      </DataToolbar>

      {contacts.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matches"
          description="No contacts match your search and filters."
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
