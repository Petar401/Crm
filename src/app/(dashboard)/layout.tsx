import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Kick both fetches off in parallel — getPermissionSet does not depend on
  // requireAuthContext's return, so awaiting them sequentially forces two
  // round-trips (auth query, then the two permission queries) instead of
  // running them concurrently. React `cache()` still de-dupes any repeats
  // downstream.
  const [ctx, { allowed }] = await Promise.all([
    requireAuthContext(),
    getPermissionSet(),
  ]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar allowed={[...allowed]} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          workspaceName={ctx.workspace.name}
          email={ctx.email}
          fullName={ctx.profile?.full_name ?? null}
          allowed={[...allowed]}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
