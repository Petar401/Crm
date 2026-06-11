import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getMembers } from "@/features/team/queries";
import { isAiConfigured } from "@/features/ai/gemini";
import { TeamSettings } from "@/features/team/components/team-settings";
import { InviteMemberDialog } from "@/features/team/components/invite-member-dialog";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireAuthContext();
  const { allowed } = await getPermissionSet();
  if (!allowed.has("settings.view")) redirect("/");

  const members = await getMembers(ctx.workspace.id);
  const canViewTeam = allowed.has("team.view");
  const canInvite = allowed.has("team.invite");
  const canEditRoles = allowed.has("team.edit_roles");

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your workspace and team"
        action={canInvite ? <InviteMemberDialog /> : undefined}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{ctx.workspace.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{ctx.workspace.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">AI features</span>
              {isAiConfigured() ? (
                <Badge variant="secondary">Enabled</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent className="max-w-sm">
            <ChangePasswordForm />
          </CardContent>
        </Card>

        {canViewTeam && (
          <div>
            <h2 className="mb-3 text-sm font-medium">
              Team members &amp; permissions
            </h2>
            <TeamSettings
              members={members}
              ownerUserId={ctx.workspace.created_by}
              canEdit={canEditRoles}
            />
            {!canEditRoles && (
              <p className="text-muted-foreground mt-2 text-xs">
                You can view the team but need the &quot;Edit roles &amp;
                permissions&quot; permission to make changes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
