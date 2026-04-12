import { describe, expect, it } from "vitest";
import { analyze } from "../index";
import type {
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../../backtest/types";

function row(cursorTime: string, opts: Partial<BacktestSignalRow> = {}): BacktestSignalRow {
  return {
    pair: "EUR/USD",
    timeframe: "H1",
    direction: "long",
    setupType: "trend_pullback",
    setupQuality: null,
    verdict: "trade",
    confidence: 70,
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
    ...opts,
  };
}

function outcome(
  kind: ResolvedOutcome["kind"],
  r: number,
  bars = 1,
  resolvedAt = "2026-01-01T02:00:00Z",
): ResolvedOutcome {
  return {
    kind,
    entryHitAt: "2026-01-01T01:00:00Z",
    resolvedAt,
    barsToResolution: bars,
    exitPrice: 1.1,
    rMultiple: r,
    pipsResult: r * 50,
    path: [],
  };
}

describe("analyze (top-level)", () => {
  it("returns metrics + equity curve + buckets + setup stats together", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("2026-01-01T00:00:00Z"), outcome: outcome("tp1_hit", 1) },
      { signal: row("2026-01-01T01:00:00Z"), outcome: outcome("sl_hit", -1) },
      { signal: row("2026-01-01T02:00:00Z"), outcome: outcome("tp1_hit", 1) },
    ];
    const out = analyze({ items });

    expect(out.metrics.totalTrades).toBe(3);
    expect(out.equityCurve).toHaveLength(3);
    expect(out.equityCurve[2].equityR).toBe(1);
    expect(out.confidenceBuckets).toHaveLength(4);
    expect(out.setupRStats["trend_pullback"].trades).toBe(3);
    expect(out.pairTimeframeStats["EUR/USD|H1"].trades).toBe(3);
    expect(out.dataGapCount).toBe(0);
  });

  it("flags expired-with-too-few-bars items as data gaps", () => {
    // Holding window of 24, but the resolver only walked 5 bars.
    const items: SignalWithOutcome[] = [
      { signal: row("2026-01-01T00:00:00Z"), outcome: outcome("expired", 0, 5) },
      { signal: row("2026-01-01T01:00:00Z"), outcome: outcome("expired", 0, 24) },
    ];
    const out = analyze({ items, maxHoldingBars: 24 });
    expect(out.dataGapCount).toBe(1);
  });

  it("returns a no-trade-quality block even when no candles are supplied", () => {
    const items: SignalWithOutcome[] = [
      { signal: row("2026-01-01T00:00:00Z", { verdict: "no_trade" }), outcome: outcome("no_entry", 0) },
    ];
    const out = analyze({ items });
    expect(out.noTradeQuality.total).toBe(1);
    expect(out.noTradeQuality.unresolved).toBe(1);
    expect(out.noTradeQuality.missRate).toBeNull();
  });
});
