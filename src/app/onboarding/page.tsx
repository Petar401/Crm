import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/session";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { OnboardingWizard } from "@/features/onboarding/components/wizard";

interface OnboardingPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { new: forceNew } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If they already have a workspace and are not explicitly here to add
  // another, send them straight in.
  const ctx = await getAuthContext();
  const memberships = await getMyWorkspaces();
  if (ctx && memberships.length > 0 && !forceNew) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-muted/30 px-4 py-12">
      <OnboardingWizard hasExistingWorkspace={memberships.length > 0} />
    </div>
  );
}
