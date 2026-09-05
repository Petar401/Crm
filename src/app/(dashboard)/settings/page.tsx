import { redirect } from "next/navigation";

import { headers } from "next/headers";

import { requireAuthContext } from "@/lib/auth/session";
import { getPermissionSet } from "@/lib/auth/permissions";
import { getMembers } from "@/features/team/queries";
import { getApiTokens } from "@/features/api-tokens/queries";
import { getRoles } from "@/features/permissions/queries";
import { getAuditLogs } from "@/features/audit/queries";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { ConnectorsPanel } from "@/features/api-tokens/components/connectors-panel";
import {
  isAiConfigured,
  getWorkspaceAiSettings,
  hasEnvFallbackKey,
  isAiEncryptionKeyConfigured,
} from "@/features/ai/settings-queries";
import { listOpenRouterFreeModels } from "@/features/ai/openrouter-models";
import { AiKeySettings } from "@/features/ai/components/ai-key-settings";
import {
  isApolloConfigured,
  getWorkspaceApolloSettings,
  isApolloEncryptionKeyConfigured,
} from "@/features/apollo/settings-queries";
import { ApolloKeySettings } from "@/features/apollo/components/apollo-key-settings";
import {
  isEmailConfigured,
  getWorkspaceEmailSettings,
  isEmailEncryptionKeyConfigured,
} from "@/features/email/settings-queries";
import { EmailConnectionSettings } from "@/features/email/components/email-connection-settings";
import { TeamSettings } from "@/features/team/components/team-settings";
import { InviteMemberDialog } from "@/features/team/components/invite-member-dialog";
import { RoleManager } from "@/features/permissions/components/role-manager";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { PreferencesPanel } from "@/features/notifications/components/preferences-panel";
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
  const canManageTokens = allowed.has("settings.tokens");
  const canManageAiKey = allowed.has("settings.update");
  const canViewAudit = allowed.has("audit.view");

  const [
    tokens,
    aiConfigured,
    aiSettings,
    openRouterModels,
    apolloConfigured,
    apolloSettings,
    emailConfigured,
    emailSettings,
    roles,
    auditRows,
    notificationPrefs,
  ] = await Promise.all([
    canManageTokens ? getApiTokens(ctx.member.id) : Promise.resolve([]),
    isAiConfigured(ctx.workspace.id),
    canManageAiKey ? getWorkspaceAiSettings(ctx.workspace.id) : Promise.resolve(null),
    canManageAiKey ? listOpenRouterFreeModels() : Promise.resolve([]),
    isApolloConfigured(ctx.workspace.id),
    canManageAiKey ? getWorkspaceApolloSettings(ctx.workspace.id) : Promise.resolve(null),
    isEmailConfigured(ctx.workspace.id),
    canManageAiKey ? getWorkspaceEmailSettings(ctx.workspace.id) : Promise.resolve(null),
    canViewTeam ? getRoles(ctx.workspace.id) : Promise.resolve([]),
    canViewAudit ? getAuditLogs(ctx.workspace.id, { limit: 100 }) : Promise.resolve([]),
    getNotificationPreferences(),
  ]);
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host") ?? "localhost:3000"}`;
  const mcpUrl = `${origin}/api/mcp`;

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
              <span className="text-muted-foreground">Timezone / Currency</span>
              <span className="font-mono text-xs">
                {ctx.workspace.timezone} · {ctx.workspace.currency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">AI features</span>
              {aiConfigured ? (
                <Badge variant="secondary">Enabled</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Apollo.io</span>
              {apolloConfigured ? (
                <Badge variant="secondary">Enabled</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Business email</span>
              {emailConfigured ? (
                <Badge variant="secondary">Connected</Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {canManageAiKey && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI API key</CardTitle>
            </CardHeader>
            <CardContent>
              <AiKeySettings
                settings={aiSettings}
                hasEnvFallback={hasEnvFallbackKey()}
                openRouterModels={openRouterModels}
                encryptionConfigured={isAiEncryptionKeyConfigured()}
              />
            </CardContent>
          </Card>
        )}

        {canManageAiKey && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apollo.io API key</CardTitle>
            </CardHeader>
            <CardContent>
              <ApolloKeySettings
                settings={apolloSettings}
                encryptionConfigured={isApolloEncryptionKeyConfigured()}
              />
            </CardContent>
          </Card>
        )}

        {canManageAiKey && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email account</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailConnectionSettings
                settings={emailSettings}
                encryptionConfigured={isEmailEncryptionKeyConfigured()}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent className="max-w-sm">
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <PreferencesPanel initial={notificationPrefs} />
          </CardContent>
        </Card>

        {canManageTokens && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connectors &amp; API tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectorsPanel tokens={tokens} mcpUrl={mcpUrl} />
            </CardContent>
          </Card>
        )}

        {canViewTeam && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <RoleManager roles={roles} canEdit={canEditRoles} />
            </CardContent>
          </Card>
        )}

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

        {canViewAudit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit log</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogTable rows={auditRows} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
