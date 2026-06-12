import "server-only";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function base(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 32px 16px; }
    .card { background: #fff; border-radius: 8px; max-width: 520px; margin: 0 auto; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #71717a; margin-bottom: 4px; }
    .title { font-size: 20px; font-weight: 700; color: #18181b; margin: 0 0 24px; }
    .meta { font-size: 14px; color: #52525b; line-height: 1.6; margin-bottom: 28px; }
    .meta strong { color: #18181b; }
    .btn { display: inline-block; background: #18181b; color: #fff !important; text-decoration: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 500; }
    .footer { font-size: 12px; color: #a1a1aa; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f4f4f5; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
    <div class="footer">You received this because you are a member of this workspace. Log in to manage your account.</div>
  </div>
</body>
</html>`;
}

export function taskAssignedTemplate(opts: {
  taskTitle: string;
  actorName: string;
  workspaceName: string;
  priority?: string;
  dueAt?: string | null;
}): string {
  const meta = [
    `<strong>${opts.actorName}</strong> assigned a task to you in <strong>${opts.workspaceName}</strong>.`,
    opts.priority ? `Priority: <strong>${opts.priority}</strong>` : "",
    opts.dueAt ? `Due: <strong>${new Date(opts.dueAt).toLocaleDateString()}</strong>` : "",
  ]
    .filter(Boolean)
    .join("<br />");

  return base(`
    <div class="label">Task assigned</div>
    <div class="title">${esc(opts.taskTitle)}</div>
    <div class="meta">${meta}</div>
    <a href="${siteUrl}/tasks" class="btn">View tasks</a>
  `);
}

export function crmCreatedTemplate(opts: {
  entityType: string;
  entityTitle: string;
  actorName: string;
  workspaceName: string;
}): string {
  const label = opts.entityType.charAt(0).toUpperCase() + opts.entityType.slice(1);
  const pathMap: Record<string, string> = {
    task: "tasks",
    note: "dashboard",
    deal: "deals",
    company: "companies",
    contact: "contacts",
  };
  const path = pathMap[opts.entityType] ?? "dashboard";

  return base(`
    <div class="label">New ${opts.entityType}</div>
    <div class="title">${esc(opts.entityTitle)}</div>
    <div class="meta">
      <strong>${esc(opts.actorName)}</strong> created a new ${opts.entityType} in <strong>${esc(opts.workspaceName)}</strong>.
    </div>
    <a href="${siteUrl}/${path}" class="btn">View in ${label}s</a>
  `);
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
