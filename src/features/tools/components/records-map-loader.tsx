"use client";

import nextDynamic from "next/dynamic";

import type { RecordsMapProps } from "@/features/tools/components/records-map";

// `ssr: false` must live in a Client Component in the App Router — this
// wrapper is that boundary; the map page (a Server Component) just renders
// this file directly.
const RecordsMap = nextDynamic(
  () => import("@/features/tools/components/records-map").then((m) => m.RecordsMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted h-[70vh] w-full animate-pulse rounded-lg border" />
    ),
  }
);

export function RecordsMapLoader(props: RecordsMapProps) {
  return <RecordsMap {...props} />;
}
