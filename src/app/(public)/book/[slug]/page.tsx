import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";

import { getFreeSlots, getPublicLinkBySlug } from "@/features/scheduling/queries";
import { BookForm } from "@/features/scheduling/components/book-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  slug: string;
}

interface Search {
  date?: string;
  time?: string;
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const raw = await searchParams;
  const pub = await getPublicLinkBySlug(slug);
  if (!pub) notFound();
  const { link, owner } = pub;

  const today = new Date();
  const day = raw.date ?? format(today, "yyyy-MM-dd");
  const slots = await getFreeSlots(link, day);

  // Small day picker: today + next 6 days.
  const dayOptions = Array.from({ length: 7 }, (_, i) =>
    format(addDays(today, i), "yyyy-MM-dd")
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <div className="text-muted-foreground text-sm">
          {owner.full_name ?? owner.email}
        </div>
        <h1 className="text-2xl font-semibold">{link.title}</h1>
        {link.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {link.description}
          </p>
        )}
        <p className="text-muted-foreground mt-1 text-xs">
          {link.duration_minutes} minutes · {link.timezone}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {dayOptions.map((d) => (
          <a
            key={d}
            href={`?date=${d}`}
            className={`rounded border px-3 py-1 text-sm ${
              d === day
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {format(new Date(`${d}T00:00:00`), "EEE d MMM")}
          </a>
        ))}
      </div>

      {raw.time ? (
        <BookForm
          slug={slug}
          startAtISO={raw.time}
          duration={link.duration_minutes}
          ownerName={owner.full_name ?? owner.email ?? "the host"}
        />
      ) : (
        <div>
          <h2 className="mb-2 font-medium">Available slots</h2>
          {slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No slots on {day}. Try another day.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <a
                  key={s.toISOString()}
                  href={`?date=${day}&time=${encodeURIComponent(s.toISOString())}`}
                  className="rounded border px-3 py-2 text-center text-sm hover:bg-blue-50"
                >
                  {format(s, "HH:mm")}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
