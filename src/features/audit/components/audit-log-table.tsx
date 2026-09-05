import { formatDistanceToNow } from "date-fns";

import type { AuditLogRow } from "@/features/audit/queries";
import { Badge } from "@/components/ui/badge";

interface AuditLogTableProps {
  rows: AuditLogRow[];
}

export function AuditLogTable({ rows }: AuditLogTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
        No audit events yet. Actions like inviting members, rotating API tokens,
        or changing permissions will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="text-muted-foreground grid grid-cols-[110px,1fr,180px,140px] gap-2 border-b px-3 py-2 text-xs font-medium">
        <span>When</span>
        <span>Action</span>
        <span>Entity</span>
        <span>Actor</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[110px,1fr,180px,140px] items-start gap-2 border-b px-3 py-2 text-sm last:border-b-0"
        >
          <span className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{r.action}</div>
            {r.after || r.before ? (
              <details className="mt-1">
                <summary className="text-muted-foreground cursor-pointer text-[11px]">
                  view payload
                </summary>
                <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded p-2 text-[10px]">
                  {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
          <span className="text-xs">
            {r.entity_type ? (
              <Badge variant="outline">{r.entity_type}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {r.actor?.full_name || r.actor?.email || "System"}
          </span>
        </div>
      ))}
    </div>
  );
}
