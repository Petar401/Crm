import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your workspace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm next={nextPath} />
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
