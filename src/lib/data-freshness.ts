// Single source of truth for "is this row stale?" decisions.
// Pure, no React, no Supabase — testable in vitest.

export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export type Freshness = "live" | "cached" | "fallback";

export function freshnessOf(
  updatedAt: string | Date | null | undefined,
  hasData: boolean,
  now: () => Date = () => new Date(),
): Freshness {
  if (!hasData) return "fallback";
  if (!updatedAt) return "cached";
  const t = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  const ageMs = now().getTime() - t.getTime();
  return ageMs < STALE_THRESHOLD_MS ? "live" : "cached";
}
