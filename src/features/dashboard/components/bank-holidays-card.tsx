import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";

interface UpcomingHoliday {
  date: string;
  title: string;
}

export function BankHolidaysCard({ holidays }: { holidays: UpcomingHoliday[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming UK bank holidays</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {holidays.map((h) => (
            <li key={h.date} className="flex items-center justify-between gap-4">
              <span>{h.title}</span>
              <span className="text-muted-foreground shrink-0">{formatDate(h.date)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
