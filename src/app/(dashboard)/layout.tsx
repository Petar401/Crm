import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ctx, { allowed }, memberships, unread] = await Promise.all([
    requireAuthContext(),
    getPermissionSet(),
    getMyWorkspaces(),
    getUnreadNotificationCount(),
  ]);

  const workspaceList = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
  }));

  return (
    <NotificationsProvider workspaceId={ctx.workspace.id} userId={ctx.userId}>
      <CommandPaletteProvider>
        <div className="flex min-h-dvh">
          <Sidebar allowed={[...allowed]} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              workspaces={workspaceList}
              activeWorkspaceId={ctx.workspace.id}
              email={ctx.email}
              fullName={ctx.profile?.full_name ?? null}
              allowed={[...allowed]}
              unreadNotifications={unread}
            />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </NotificationsProvider>
  );
}
