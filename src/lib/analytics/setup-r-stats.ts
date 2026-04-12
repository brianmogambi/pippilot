// Phase 11: Sample-size-gated breakdowns over the existing
// `BacktestMetrics` produced by `src/lib/backtest/metrics.ts`.
//
// We do not recompute anything — we wrap each per-setup / per-(pair,
// timeframe) bucket with an `insufficientSample` flag so the UI can
// suppress noise from buckets with fewer than `MIN_SAMPLE_SIZE` trades.
// Pure / deterministic.

import type { BacktestMetrics, BreakdownStats, SignalWithOutcome } from "../backtest/types";
import {
  MIN_SAMPLE_SIZE,
  type GatedBreakdownStats,
  type PairTimeframeStats,
} from "./types";

const WIN_KINDS = new Set(["tp1_hit", "tp2_hit", "tp3_hit"]);
const LOSS_KINDS = new Set(["sl_hit"]);

/** Wrap a setup-type breakdown map with sample-size flags. */
export function gateSetupBreakdown(
  bySetup: BacktestMetrics["breakdownBySetup"],
): Record<string, GatedBreakdownStats> {
  const out: Record<string, GatedBreakdownStats> = {};
  for (const [key, stats] of Object.entries(bySetup)) {
    out[key] = gate(stats);
  }
  return out;
}

/**
 * Compute per-(pair × timeframe) win-rate / R stats from raw items.
 *
 * `BacktestMetrics` only exposes pair and timeframe breakdowns separately;
 * the analytics surface needs the cross-tab to highlight strong/weak
 * combinations like "EUR/USD H4 vs EUR/USD H1".
 */
export function computePairTimeframeStats(
  items: SignalWithOutcome[],
): PairTimeframeStats {
  const buckets: Record<string, { trades: number; wins: number; losses: number; totalR: number }> = {};

  for (const { signal, outcome } of items) {
    if (signal.verdict !== "trade") continue;
    if (outcome.kind === "no_entry") continue;

    const key = `${signal.pair}|${signal.timeframe}`;
    if (!buckets[key]) buckets[key] = { trades: 0, wins: 0, losses: 0, totalR: 0 };
    const b = buckets[key];

    b.trades++;
    b.totalR += outcome.rMultiple ?? 0;
    if (WIN_KINDS.has(outcome.kind)) b.wins++;
    else if (LOSS_KINDS.has(outcome.kind)) b.losses++;
  }

  const out: PairTimeframeStats = {};
  for (const [key, b] of Object.entries(buckets)) {
    const resolved = b.wins + b.losses;
    const winRate = resolved > 0 ? round(b.wins / resolved, 4) : 0;
    const avgR = b.trades > 0 ? round(b.totalR / b.trades, 4) : 0;
    out[key] = {
      trades: b.trades,
      wins: b.wins,
      losses: b.losses,
      winRate,
      avgR,
      expectancyR: avgR,
      totalR: round(b.totalR, 4),
      insufficientSample: b.trades < MIN_SAMPLE_SIZE,
    };
  }
  return out;
}

function gate(stats: BreakdownStats): GatedBreakdownStats {
  return {
    trades: stats.trades,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    avgR: stats.avgR,
    expectancyR: stats.expectancyR,
    totalR: stats.totalR,
    insufficientSample: stats.trades < MIN_SAMPLE_SIZE,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
