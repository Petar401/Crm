import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { acceptInvitationAction } from "@/features/workspaces/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  // Peek at the invitation to show the workspace name before accepting.
  const { data: invitation } = await supabase
    .from("workspace_invitations")
    .select("*, workspaces(name)")
    .eq("token", token)
    .maybeSingle<{
      email: string;
      accepted_at: string | null;
      expires_at: string;
      workspaces: { name: string } | { name: string }[] | null;
    }>();

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              This invite link is invalid or has been revoked.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const workspace = Array.isArray(invitation.workspaces)
    ? invitation.workspaces[0]
    : invitation.workspaces;

  async function accept() {
    "use server";
    const res = await acceptInvitationAction(token);
    if (res.error) throw new Error(res.error);
    redirect("/");
  }

  const expired = new Date(invitation.expires_at) < new Date();
  const emailMismatch =
    (user.email ?? "").toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join {workspace?.name ?? "workspace"}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation.accepted_at ? (
            <p className="text-sm text-muted-foreground">
              This invitation has already been used.
            </p>
          ) : expired ? (
            <p className="text-sm text-destructive">
              This invitation has expired.
            </p>
          ) : emailMismatch ? (
            <p className="text-sm text-destructive">
              This invitation was sent to {invitation.email}. Sign in with that
              email to accept.
            </p>
          ) : (
            <form action={accept}>
              <Button type="submit" className="w-full">
                Accept invitation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
