import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { listEventsInRange } from "@/features/calendar/queries";
import { getDeals } from "@/features/deals/queries";
import { getCompanies } from "@/features/companies/queries";
import { getContacts } from "@/features/contacts/queries";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

type View = "month" | "week" | "day";

interface Search {
  view?: string;
  date?: string;
}

function windowFor(view: View, focusISO: string): { from: string; to: string } {
  const d = new Date(focusISO);
  const from = new Date(d);
  const to = new Date(d);
  if (view === "month") {
    from.setDate(1);
    from.setDate(from.getDate() - 7);
    to.setMonth(to.getMonth() + 1);
    to.setDate(7);
  } else if (view === "week") {
    from.setDate(from.getDate() - 7);
    to.setDate(to.getDate() + 7);
  } else {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() + 2);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("calendar.view")) redirect("/");

  const raw = await searchParams;
  const view: View = (raw.view === "week" || raw.view === "day"
    ? raw.view
    : "month") as View;
  const date = raw.date ?? new Date().toISOString().slice(0, 10);

  const { from, to } = windowFor(view, date);

  const [events, deals, companies, contacts] = await Promise.all([
    listEventsInRange(ctx.workspace.id, from, to),
    getDeals(ctx.workspace.id),
    getCompanies(ctx.workspace.id),
    getContacts(ctx.workspace.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Meetings, calls and time blocks — with your CRM context attached."
      />
      <CalendarView
        events={events}
        initialDate={date}
        initialView={view}
        deals={deals.map((d) => ({
          id: d.id,
          name: d.name,
          company_id: d.company_id,
          primary_contact_id: d.primary_contact_id,
        }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          full_name: c.full_name,
          company_id: c.company_id,
          email: c.email,
        }))}
        canCreate={allowed.has("calendar.create")}
        canUpdate={allowed.has("calendar.update")}
        canDelete={allowed.has("calendar.delete")}
      />
    </div>
  );
}
