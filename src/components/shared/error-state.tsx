"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, or head back to your dashboard.",
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      {error?.message && (
        <p className="text-muted-foreground/80 mt-2 max-w-sm truncate text-xs">
          {error.message}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {reset && (
          <Button onClick={reset}>
            <RotateCw className="size-4" />
            Try again
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
