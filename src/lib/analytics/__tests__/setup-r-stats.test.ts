import { describe, expect, it } from "vitest";
import { computePairTimeframeStats, gateSetupBreakdown } from "../setup-r-stats";
import { computeMetrics } from "../../backtest/metrics";
import { MIN_SAMPLE_SIZE } from "../types";
import type {
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../../backtest/types";

function row(
  pair: string,
  setupType: string,
  timeframe: string,
  cursorTime: string,
): BacktestSignalRow {
  return {
    pair,
    timeframe,
    direction: "long",
    setupType,
    setupQuality: null,
    verdict: "trade",
    confidence: 60,
    entryPrice: 1.1,
    stopLoss: 1.095,
    tp1: 1.105,
    tp2: 1.108,
    tp3: 1.11,
    riskReward: 1,
    cursorTime,
    reasonsFor: [],
    reasonsAgainst: [],
    invalidation: "",
  };
}

function outcome(kind: ResolvedOutcome["kind"], r: number): ResolvedOutcome {
  return {
    kind,
    entryHitAt: "2026-01-01T01:00:00Z",
    resolvedAt: "2026-01-01T02:00:00Z",
    barsToResolution: 1,
    exitPrice: 1.1,
    rMultiple: r,
    pipsResult: r * 50,
    path: [],
  };
}

describe("gateSetupBreakdown", () => {
  it("flags small buckets as insufficientSample and large ones as not", () => {
    const items: SignalWithOutcome[] = [];
    // 6 trades for trend_pullback — above MIN_SAMPLE_SIZE
    for (let i = 0; i < 6; i++) {
      items.push({
        signal: row("EUR/USD", "trend_pullback", "H1", `2026-01-01T0${i}:00:00Z`),
        outcome: outcome("tp1_hit", 1),
      });
    }
    // 2 trades for breakout_retest — below MIN_SAMPLE_SIZE
    items.push({
      signal: row("EUR/USD", "breakout_retest", "H1", "2026-01-01T10:00:00Z"),
      outcome: outcome("tp1_hit", 1),
    });
    items.push({
      signal: row("EUR/USD", "breakout_retest", "H1", "2026-01-01T11:00:00Z"),
      outcome: outcome("sl_hit", -1),
    });

    const m = computeMetrics(items);
    const gated = gateSetupBreakdown(m.breakdownBySetup);

    expect(gated["trend_pullback"].trades).toBe(6);
    expect(gated["trend_pullback"].insufficientSample).toBe(false);
    expect(gated["breakout_retest"].trades).toBe(2);
    expect(gated["breakout_retest"].insufficientSample).toBe(true);
    expect(MIN_SAMPLE_SIZE).toBe(5);
  });
});

describe("computePairTimeframeStats", () => {
  it("aggregates win rate and avg R per (pair, timeframe) key", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("EUR/USD", "trend_pullback", "H1", "2026-01-01T00:00:00Z"), outcome: outcome("tp1_hit", 1) },
      { signal: row("EUR/USD", "trend_pullback", "H1", "2026-01-01T01:00:00Z"), outcome: outcome("sl_hit", -1) },
      { signal: row("EUR/USD", "trend_pullback", "H4", "2026-01-01T02:00:00Z"), outcome: outcome("tp1_hit", 1) },
      { signal: row("GBP/USD", "trend_pullback", "H1", "2026-01-01T03:00:00Z"), outcome: outcome("tp1_hit", 1) },
    ];
    const stats = computePairTimeframeStats(items);
    expect(stats["EUR/USD|H1"].trades).toBe(2);
    expect(stats["EUR/USD|H1"].winRate).toBe(0.5);
    expect(stats["EUR/USD|H4"].trades).toBe(1);
    expect(stats["GBP/USD|H1"].trades).toBe(1);
    // All buckets are tiny — every one should be flagged.
    for (const key of Object.keys(stats)) {
      expect(stats[key].insufficientSample).toBe(true);
    }
  });
});
