// Single source of truth for "is this row stale?" decisions.
// Pure, no React, no Supabase — testable in vitest.

export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const SIGNAL_STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

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

/** Signal freshness uses a longer threshold (4 hours) since signals
 *  are generated less frequently than market data. */
export function signalFreshnessOf(
  newestCreatedAt: string | Date | null | undefined,
  hasSignals: boolean,
  now: () => Date = () => new Date(),
): Freshness {
  if (!hasSignals) return "fallback";
  if (!newestCreatedAt) return "cached";
  const t = typeof newestCreatedAt === "string" ? new Date(newestCreatedAt) : newestCreatedAt;
  const ageMs = now().getTime() - t.getTime();
  return ageMs < SIGNAL_STALE_THRESHOLD_MS ? "live" : "cached";
}

/** Human-readable age label for signal freshness. */
export function signalAgeLabel(
  newestCreatedAt: string | Date | null | undefined,
  now: () => Date = () => new Date(),
): string {
  if (!newestCreatedAt) return "No signals yet";
  const t = typeof newestCreatedAt === "string" ? new Date(newestCreatedAt) : newestCreatedAt;
  const ageMs = now().getTime() - t.getTime();
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  const minutes = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}
