"use client";

import { Badge } from "@/components/ui/badge";

export interface MailRow {
  key: string;
  title: string;
  subtitle: string;
  snippet?: string;
  date: string | null;
  unread?: boolean;
  failed?: boolean;
}

interface Props {
  rows: MailRow[];
  onSelect: (key: string) => void;
}

export function MailboxList({ rows, onSelect }: Props) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            onClick={() => onSelect(row.key)}
            className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`truncate text-sm ${
                    row.unread ? "font-semibold" : "font-medium"
                  }`}
                >
                  {row.title}
                </span>
                {row.failed && (
                  <Badge variant="destructive" className="shrink-0">
                    Failed
                  </Badge>
                )}
              </div>
              <div className="text-foreground truncate text-sm">{row.subtitle}</div>
              {row.snippet && (
                <div className="text-muted-foreground truncate text-xs">
                  {row.snippet}
                </div>
              )}
            </div>
            {row.date && (
              <span className="text-muted-foreground shrink-0 text-xs">
                {new Date(row.date).toLocaleDateString()}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
