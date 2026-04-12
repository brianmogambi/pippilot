import { describe, it, expect } from "vitest";
import { computeMetrics } from "../metrics";
import type { BacktestSignalRow, ResolvedOutcome, SignalWithOutcome } from "../types";

function row(
  pair: string,
  setupType: string,
  timeframe: string,
  cursorTime: string,
  verdict: "trade" | "no_trade" = "trade",
): BacktestSignalRow {
  return {
    pair,
    timeframe,
    direction: "long",
    setupType,
    setupQuality: "B",
    verdict,
    confidence: 60,
    entryPrice: 1.1,
    stopLoss: 1.095,
    tp1: 1.105,
    tp2: 1.11,
    tp3: 1.115,
    riskReward: 1.5,
    cursorTime,
    reasonsFor: [],
    reasonsAgainst: [],
    invalidation: "",
  };
}

function outcome(kind: ResolvedOutcome["kind"], rMultiple: number, resolvedAt = "2026-01-01T01:00:00Z"): ResolvedOutcome {
  return {
    kind,
    entryHitAt: "2026-01-01T01:00:00Z",
    resolvedAt,
    barsToResolution: 1,
    exitPrice: 1.1,
    rMultiple,
    pipsResult: rMultiple * 50,
    path: [],
  };
}

describe("computeMetrics — basic", () => {
  it("computes win rate and expectancy for 6W/4L mix", () => {
    const items: SignalWithOutcome[] = [];
    const wins: ResolvedOutcome["kind"][] = ["tp1_hit", "tp1_hit", "tp1_hit", "tp2_hit", "tp2_hit", "tp3_hit"];
    for (let i = 0; i < 6; i++) {
      items.push({
        signal: row("EUR/USD", "trend_pullback", "H1", `2026-01-01T0${i}:00:00Z`),
        outcome: outcome(wins[i], 1),
      });
    }
    for (let i = 0; i < 4; i++) {
      items.push({
        signal: row("EUR/USD", "trend_pullback", "H1", `2026-01-01T1${i}:00:00Z`),
        outcome: outcome("sl_hit", -1),
      });
    }
    const m = computeMetrics(items);
    expect(m.totalTrades).toBe(10);
    expect(m.wins).toBe(6);
    expect(m.losses).toBe(4);
    expect(m.winRate).toBe(0.6);
    expect(m.avgR).toBeCloseTo(0.2, 4);
    expect(m.expectancyR).toBeCloseTo(0.2, 4);
    expect(m.profitFactor).toBeCloseTo(1.5, 2);
  });

  it("excludes no_trade verdicts from totalTrades but counts in totalSignals", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("EUR/USD", "trend_pullback", "H1", "2026-01-01T00:00:00Z", "no_trade"), outcome: outcome("no_entry", 0) },
      { signal: row("EUR/USD", "trend_pullback", "H1", "2026-01-01T01:00:00Z", "trade"), outcome: outcome("tp1_hit", 1) },
    ];
    const m = computeMetrics(items);
    expect(m.totalSignals).toBe(2);
    expect(m.totalTrades).toBe(1);
  });
});

describe("computeMetrics — max drawdown", () => {
  it("tracks running peak − equity correctly for [+1, -1, -1, -1, +1, +1]", () => {
    const seq = [1, -1, -1, -1, 1, 1];
    const items: SignalWithOutcome[] = seq.map((r, i) => ({
      signal: row("EUR/USD", "trend_pullback", "H1", `2026-01-01T0${i}:00:00Z`),
      outcome: outcome(r > 0 ? "tp1_hit" : "sl_hit", r),
    }));
    const m = computeMetrics(items);
    // Equity curve: 1, 0, -1, -2, -1, 0. Peak = 1 (after bar 0). Trough = -2. Max DD = 1 - (-2) = 3.
    expect(m.maxDrawdownR).toBe(3);
  });
});

describe("computeMetrics — breakdowns", () => {
  it("aggregates correctly by pair, setup, and timeframe", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("EUR/USD", "trend_pullback", "H1", "2026-01-01T00:00:00Z"), outcome: outcome("tp1_hit", 1) },
      { signal: row("EUR/USD", "breakout_retest", "H4", "2026-01-01T01:00:00Z"), outcome: outcome("sl_hit", -1) },
      { signal: row("GBP/USD", "trend_pullback", "H1", "2026-01-01T02:00:00Z"), outcome: outcome("tp2_hit", 1) },
    ];
    const m = computeMetrics(items);
    expect(m.breakdownByPair["EUR/USD"].trades).toBe(2);
    expect(m.breakdownByPair["EUR/USD"].wins).toBe(1);
    expect(m.breakdownByPair["EUR/USD"].losses).toBe(1);
    expect(m.breakdownByPair["GBP/USD"].trades).toBe(1);
    expect(m.breakdownBySetup["trend_pullback"].trades).toBe(2);
    expect(m.breakdownBySetup["breakout_retest"].trades).toBe(1);
    expect(m.breakdownByTimeframe["H1"].trades).toBe(2);
    expect(m.breakdownByTimeframe["H4"].trades).toBe(1);
  });
});
