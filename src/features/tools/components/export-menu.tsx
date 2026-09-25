import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ExportEntity = "companies" | "contacts" | "deals" | "leads" | "tasks";

const CSV_LABEL: Record<ExportEntity, string> = {
  companies: "Companies (.csv)",
  contacts: "Contacts (.csv)",
  deals: "Deals (.csv)",
  leads: "Leads (.csv)",
  tasks: "Tasks (.csv)",
};

interface ExportMenuProps {
  entity: ExportEntity;
  /** Contacts: also offer every contact as a vCard address-book file. */
  vcard?: boolean;
  /** Deals/tasks: also offer the shared workspace calendar. */
  calendar?: boolean;
  /** Tasks: also offer a calendar of just the current user's tasks. */
  myCalendar?: boolean;
}

/**
 * "Export" menu of plain download links — no fetch, so the browser handles
 * the file save itself. Rendered only when the caller already holds the
 * matching `.view` permission (the export endpoints re-check it server-side).
 */
export function ExportMenu({ entity, vcard, calendar, myCalendar }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`/api/export/csv/${entity}`} download>
            {CSV_LABEL[entity]}
          </a>
        </DropdownMenuItem>
        {vcard && (
          <DropdownMenuItem asChild>
            <a href="/api/export/vcard" download>
              vCards (.vcf)
            </a>
          </DropdownMenuItem>
        )}
        {calendar && (
          <DropdownMenuItem asChild>
            <a href="/api/export/calendar" download>
              Calendar (.ics)
            </a>
          </DropdownMenuItem>
        )}
        {myCalendar && (
          <DropdownMenuItem asChild>
            <a href="/api/export/calendar?scope=mine" download>
              My calendar (.ics)
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
