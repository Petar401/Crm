import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { validateAuthorize, redirectWith } from "@/features/oauth/authorize";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Query keys forwarded to the consent POST as hidden fields. */
const FORWARDED = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "resource",
] as const;

function flatten(
  sp: Record<string, string | string[] | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value) && value[0]) out[key] = value[0];
  }
  return out;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = flatten(await searchParams);
  const result = await validateAuthorize(params);

  if (result.status === "invalid_client") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Can&apos;t connect</CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Close this window and try adding the connector again.
        </CardContent>
      </Card>
    );
  }

  if (result.status === "error") {
    redirect(
      redirectWith(result.redirectUri, {
        error: result.error,
        error_description: result.description,
        state: result.state,
      })
    );
  }

  // Authorization request is valid — require a signed-in CRM user, returning
  // here after login so the flow resumes.
  const ctx = await getAuthContext();
  if (!ctx) {
    const next = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const clientName = result.client.client_name?.trim() || "An application";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect {clientName}</CardTitle>
        <CardDescription>
          {clientName} is requesting access to your CRM workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="text-muted-foreground">Signed in as</div>
          <div className="font-medium">{ctx.email}</div>
          <div className="text-muted-foreground mt-2">
            It will be able to read and write your workspace&apos;s companies,
            contacts, deals, tasks, notes and leads — always limited to your own
            permissions.
          </div>
        </div>
        <form method="post" action="/api/oauth/authorize" className="space-y-3">
          {FORWARDED.map((key) =>
            params[key] !== undefined ? (
              <input key={key} type="hidden" name={key} value={params[key]} />
            ) : null
          )}
          <Button
            type="submit"
            name="decision"
            value="approve"
            className="w-full"
          >
            Approve
          </Button>
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
