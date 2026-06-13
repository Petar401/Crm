"use client";

import { useEffect } from "react";

import "./globals.css";
import { ErrorState } from "@/components/shared/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <ErrorState error={error} reset={reset} />
          </div>
        </main>
      </body>
    </html>
  );
}
