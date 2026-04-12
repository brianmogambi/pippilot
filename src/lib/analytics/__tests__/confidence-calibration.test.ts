import { describe, expect, it } from "vitest";
import { computeConfidenceBuckets } from "../confidence-calibration";
import { MIN_SAMPLE_SIZE } from "../types";
import type {
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../../backtest/types";

function row(confidence: number, verdict: "trade" | "no_trade" = "trade"): BacktestSignalRow {
  return {
    pair: "EUR/USD",
    timeframe: "H1",
    direction: "long",
    setupType: "trend_pullback",
    setupQuality: "B",
    verdict,
    confidence,
    entryPrice: 1.1,
    stopLoss: 1.095,
    tp1: 1.105,
    tp2: 1.11,
    tp3: 1.115,
    riskReward: 1.5,
    cursorTime: "2026-01-01T00:00:00Z",
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

describe("computeConfidenceBuckets", () => {
  it("returns 4 buckets even when input is empty", () => {
    const b = computeConfidenceBuckets([]);
    expect(b).toHaveLength(4);
    expect(b.every((x) => x.trades === 0)).toBe(true);
    expect(b.every((x) => x.insufficientSample)).toBe(true);
  });

  it("buckets confidence scores into [0,40), [40,60), [60,80), [80,101)", () => {
    const items: SignalWithOutcome[] = [
      { signal: row(20), outcome: outcome("tp1_hit", 1) },
      { signal: row(50), outcome: outcome("sl_hit", -1) },
      { signal: row(70), outcome: outcome("tp1_hit", 1) },
      { signal: row(90), outcome: outcome("tp1_hit", 1) },
      { signal: row(100), outcome: outcome("tp1_hit", 1) },
    ];
    const buckets = computeConfidenceBuckets(items);
    expect(buckets[0].trades).toBe(1); // 0-40
    expect(buckets[1].trades).toBe(1); // 40-60
    expect(buckets[2].trades).toBe(1); // 60-80
    expect(buckets[3].trades).toBe(2); // 80-101 (includes 100)
  });

  it("computes win rate and avg R per bucket", () => {
    // 5 trades in 60-80 bucket: 3 wins (R=1), 2 losses (R=-1)
    const items: SignalWithOutcome[] = [
      { signal: row(60), outcome: outcome("tp1_hit", 1) },
      { signal: row(65), outcome: outcome("tp1_hit", 1) },
      { signal: row(70), outcome: outcome("tp1_hit", 1) },
      { signal: row(75), outcome: outcome("sl_hit", -1) },
      { signal: row(78), outcome: outcome("sl_hit", -1) },
    ];
    const buckets = computeConfidenceBuckets(items);
    const mid = buckets[2];
    expect(mid.trades).toBe(5);
    expect(mid.wins).toBe(3);
    expect(mid.losses).toBe(2);
    expect(mid.winRate).toBe(0.6);
    expect(mid.avgR).toBeCloseTo(0.2, 4);
    expect(mid.insufficientSample).toBe(false);
  });

  it("flags buckets below MIN_SAMPLE_SIZE as insufficient", () => {
    const items: SignalWithOutcome[] = [
      { signal: row(85), outcome: outcome("tp1_hit", 1) },
    ];
    const buckets = computeConfidenceBuckets(items);
    const top = buckets[3];
    expect(top.trades).toBe(1);
    expect(top.trades).toBeLessThan(MIN_SAMPLE_SIZE);
    expect(top.insufficientSample).toBe(true);
  });

  it("excludes no_trade verdicts and no_entry outcomes", () => {
    const items: SignalWithOutcome[] = [
      { signal: row(70, "no_trade"), outcome: outcome("no_entry", 0) },
      { signal: row(70, "trade"), outcome: outcome("no_entry", 0) },
      { signal: row(70, "trade"), outcome: outcome("tp1_hit", 1) },
    ];
    const buckets = computeConfidenceBuckets(items);
    expect(buckets[2].trades).toBe(1);
  });
});
