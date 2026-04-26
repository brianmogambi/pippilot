// src/lib/signal-presentation.ts
//
// Phase 1 (improvement plan): client-side derivations that turn an
// EnrichedSignal into the trust signals a beginner needs to act on
// — beginner-friendly tag, account suitability, primary risk, signal
// age, and potential loss in account currency. Pure, no React, no
// Supabase — testable in vitest. Safe to graduate to the Edge
// Function later if the heuristics prove out.
//
// Why these heuristics live here, not in the engine: confidence,
// quality, R:R, and reasonsAgainst are already produced by
// generate-signals. This module just decides how to *present* them.

import type { EnrichedSignal } from "@/types/trading";

// ── Beginner-friendly tag ───────────────────────────────────────

export interface BeginnerFriendlyResult {
  friendly: boolean;
  reason: string;
}

export function getBeginnerFriendlyTag(
  signal: EnrichedSignal,
): BeginnerFriendlyResult {
  const quality = signal.analysis?.setupQuality ?? null;
  const isHighQuality = quality === "A+" || quality === "A";
  const isHighConfidence = signal.confidence >= 70;
  const hasGoodRR = (signal.riskReward ?? 0) >= 2;
  const isTradeVerdict = signal.verdict === "trade";

  if (!isTradeVerdict) {
    return { friendly: false, reason: "No-trade signals are not for execution." };
  }
  if (!isHighQuality) {
    return {
      friendly: false,
      reason: `Setup quality is ${quality ?? "unknown"} — beginners should wait for A+ or A setups.`,
    };
  }
  if (!isHighConfidence) {
    return {
      friendly: false,
      reason: `Confidence is ${signal.confidence}% — beginners should look for 70%+.`,
    };
  }
  if (!hasGoodRR) {
    return {
      friendly: false,
      reason: `Risk-reward is ${(signal.riskReward ?? 0).toFixed(1)}R — beginners should aim for 2R or better.`,
    };
  }
  return {
    friendly: true,
    reason: `Strong ${quality} setup, ${(signal.riskReward ?? 0).toFixed(1)}R, ${signal.confidence}% confidence.`,
  };
}

// ── Account suitability ─────────────────────────────────────────

export type AccountSuitability = "real" | "demo_only" | "no_trade";

export interface AccountSuitabilityResult {
  level: AccountSuitability;
  reason: string;
}

export function getAccountSuitability(
  signal: EnrichedSignal,
): AccountSuitabilityResult {
  if (signal.verdict === "no_trade") {
    return {
      level: "no_trade",
      reason: "Conditions don't meet the engine's trade threshold.",
    };
  }
  const quality = signal.analysis?.setupQuality ?? null;
  const isTopQuality = quality === "A+" || quality === "A";
  const isStrongConfidence = signal.confidence >= 75;

  if (isTopQuality && isStrongConfidence) {
    return {
      level: "real",
      reason: `${quality} quality at ${signal.confidence}% confidence — suitable for a real account with disciplined sizing.`,
    };
  }
  return {
    level: "demo_only",
    reason: `Quality ${quality ?? "—"} at ${signal.confidence}% confidence — practice on a demo account first.`,
  };
}

// ── Primary risk ("why this could fail") ────────────────────────

/**
 * Returns the most prominent reason this trade could fail. Prefers
 * the first item from the engine-produced reasonsAgainst list (which
 * is already templated or AI-generated). Falls back to a derived
 * statement when the analysis is missing or empty.
 */
export function getPrimaryRisk(signal: EnrichedSignal): string | null {
  const fromAnalysis = signal.analysis?.reasonsAgainst?.[0]?.trim();
  if (fromAnalysis) return fromAnalysis;

  if (signal.confidence < 50) {
    return `Low confidence (${signal.confidence}%) — confluence is weak; the setup may not follow through.`;
  }
  const rr = signal.riskReward ?? 0;
  if (rr < 1.5) {
    return `Risk-reward is ${rr.toFixed(2)}R — limited room to be wrong before the math turns against you.`;
  }
  return null;
}

// ── Signal age ──────────────────────────────────────────────────

export type SignalStaleness = "fresh" | "aging" | "stale";

export const SIGNAL_FRESH_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h
export const SIGNAL_STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6h

export interface SignalAgeResult {
  ageMs: number;
  label: string;
  staleness: SignalStaleness;
}

export function getSignalAge(
  signal: { created_at: string | Date | null | undefined },
  now: () => Date = () => new Date(),
): SignalAgeResult {
  if (!signal.created_at) {
    return { ageMs: Infinity, label: "Unknown age", staleness: "stale" };
  }
  const t =
    typeof signal.created_at === "string"
      ? new Date(signal.created_at)
      : signal.created_at;
  const ageMs = Math.max(0, now().getTime() - t.getTime());
  const staleness: SignalStaleness =
    ageMs < SIGNAL_FRESH_THRESHOLD_MS
      ? "fresh"
      : ageMs < SIGNAL_STALE_THRESHOLD_MS
        ? "aging"
        : "stale";
  return { ageMs, label: formatAgeLabel(ageMs), staleness };
}

function formatAgeLabel(ageMs: number): string {
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Potential loss preview ──────────────────────────────────────

/**
 * Translates "X% of account" into the dollar amount at risk. By
 * definition, when the user takes a risk-sized lot, this is the
 * loss they incur if the stop loss hits. Intended for surfacing on
 * a signal card before the user has touched the calculator.
 */
export interface PotentialLossResult {
  riskUsd: number;
  pctOfAccount: number;
}

export function getPotentialLoss(
  balance: number,
  riskPct: number,
): PotentialLossResult | null {
  if (!Number.isFinite(balance) || balance <= 0) return null;
  if (!Number.isFinite(riskPct) || riskPct <= 0) return null;
  return {
    riskUsd: Math.round(balance * (riskPct / 100) * 100) / 100,
    pctOfAccount: riskPct,
  };
}
