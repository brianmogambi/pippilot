import { describe, expect, it } from "vitest";
import { computeEquityCurve } from "../equity-curve";
import { computeMetrics } from "../../backtest/metrics";
import type {
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../../backtest/types";

function row(cursorTime: string, verdict: "trade" | "no_trade" = "trade"): BacktestSignalRow {
  return {
    pair: "EUR/USD",
    timeframe: "H1",
    direction: "long",
    setupType: "trend_pullback",
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

function outcome(
  kind: ResolvedOutcome["kind"],
  rMultiple: number,
  resolvedAt = "2026-01-01T01:00:00Z",
): ResolvedOutcome {
  return {
    kind,
    entryHitAt: resolvedAt,
    resolvedAt,
    barsToResolution: 1,
    exitPrice: 1.1,
    rMultiple,
    pipsResult: rMultiple * 50,
    path: [],
  };
}

describe("computeEquityCurve", () => {
  it("returns empty array for empty input", () => {
    expect(computeEquityCurve([])).toEqual([]);
  });

  it("walks chronologically and accumulates R", () => {
    const seq = [1, -1, 1];
    const items: SignalWithOutcome[] = seq.map((r, i) => ({
      signal: row(`2026-01-01T0${i}:00:00Z`),
      outcome: outcome(r > 0 ? "tp1_hit" : "sl_hit", r, `2026-01-01T0${i + 1}:00:00Z`),
    }));
    const curve = computeEquityCurve(items);
    expect(curve.map((p) => p.equityR)).toEqual([1, 0, 1]);
    expect(curve.map((p) => p.tradeR)).toEqual([1, -1, 1]);
  });

  it("sorts by cursorTime regardless of input order", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("2026-01-01T03:00:00Z"), outcome: outcome("tp1_hit", 1, "2026-01-01T04:00:00Z") },
      { signal: row("2026-01-01T01:00:00Z"), outcome: outcome("sl_hit", -1, "2026-01-01T02:00:00Z") },
    ];
    const curve = computeEquityCurve(items);
    expect(curve.map((p) => p.equityR)).toEqual([-1, 0]);
  });

  it("parity check: peak − min(equityR) matches metrics.maxDrawdownR", () => {
    // Same fixture as the metrics drawdown test.
    const seq = [1, -1, -1, -1, 1, 1];
    const items: SignalWithOutcome[] = seq.map((r, i) => ({
      signal: row(`2026-01-01T0${i}:00:00Z`),
      outcome: outcome(r > 0 ? "tp1_hit" : "sl_hit", r),
    }));
    const m = computeMetrics(items);
    const curve = computeEquityCurve(items);

    // Walk peak − equity manually and compare to metrics.maxDrawdownR.
    let peak = 0;
    let maxDd = 0;
    for (const p of curve) {
      if (p.equityR > peak) peak = p.equityR;
      const dd = peak - p.equityR;
      if (dd > maxDd) maxDd = dd;
    }
    expect(maxDd).toBe(m.maxDrawdownR);
    expect(maxDd).toBe(3);
  });

  it("ignores no_entry rows (rMultiple null)", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("2026-01-01T00:00:00Z", "no_trade"), outcome: { ...outcome("no_entry", 0), rMultiple: null } },
      { signal: row("2026-01-01T01:00:00Z"), outcome: outcome("tp1_hit", 1) },
    ];
    const curve = computeEquityCurve(items);
    expect(curve.map((p) => p.equityR)).toEqual([0, 1]);
  });
});
