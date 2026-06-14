/**
 * Lead scoring helpers shared by the discovery engine, the review table, and the
 * detail page. The score is a 0–100 "point" value; `scoreTier` buckets it into
 * Hot / Warm / Cold for colour-coded badges.
 */
export type ScoreTier = "hot" | "warm" | "cold";

export function scoreTier(score: number | null | undefined): ScoreTier | null {
  if (score == null) return null;
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export const SCORE_TIER_LABEL: Record<ScoreTier, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const SCORE_TIER_STYLE: Record<ScoreTier, string> = {
  hot: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warm: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cold: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
