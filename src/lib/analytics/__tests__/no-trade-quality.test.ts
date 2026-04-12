import { describe, expect, it } from "vitest";
import { computeNoTradeQuality } from "../no-trade-quality";
import type { AnalyticsInput } from "../types";
import type {
  BacktestCandle,
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../../backtest/types";

function row(verdict: "trade" | "no_trade" = "no_trade"): BacktestSignalRow {
  return {
    pair: "EUR/USD",
    timeframe: "H1",
    direction: "long",
    setupType: "trend_pullback",
    setupQuality: null,
    verdict,
    confidence: 50,
    entryPrice: 1.1,
    stopLoss: 1.095,
    tp1: 1.105,
    tp2: 1.108,
    tp3: 1.11,
    riskReward: 1,
    cursorTime: "2026-01-01T00:00:00Z",
    reasonsFor: [],
    reasonsAgainst: [],
    invalidation: "",
  };
}

const placeholderOutcome: ResolvedOutcome = {
  kind: "no_entry",
  entryHitAt: null,
  resolvedAt: "2026-01-01T00:00:00Z",
  barsToResolution: 0,
  exitPrice: null,
  rMultiple: null,
  pipsResult: null,
  path: [],
};

function tpHitCandles(): BacktestCandle[] {
  return [
    { time: "2026-01-01T01:00:00Z", open: 1.1, high: 1.102, low: 1.099, close: 1.101 },
    { time: "2026-01-01T02:00:00Z", open: 1.101, high: 1.106, low: 1.1, close: 1.106 },
  ];
}

function slHitCandles(): BacktestCandle[] {
  return [
    { time: "2026-01-01T01:00:00Z", open: 1.1, high: 1.101, low: 1.094, close: 1.094 },
  ];
}

function expiredCandles(): BacktestCandle[] {
  // Many bars all flat in the middle of the range — never reach SL or TP.
  const out: BacktestCandle[] = [];
  for (let i = 1; i <= 30; i++) {
    out.push({
      time: `2026-01-01T${String(i).padStart(2, "0")}:00:00Z`,
      open: 1.1,
      high: 1.1005,
      low: 1.0995,
      close: 1.1,
    });
  }
  return out;
}

function makeItem(): SignalWithOutcome {
  return { signal: row("no_trade"), outcome: placeholderOutcome };
}

describe("computeNoTradeQuality", () => {
  it("returns all-zero stats when no_trade rows are absent", () => {
    const input: AnalyticsInput = { items: [{ signal: row("trade"), outcome: placeholderOutcome }] };
    const stats = computeNoTradeQuality(input);
    expect(stats.total).toBe(0);
    expect(stats.unresolved).toBe(0);
    expect(stats.missRate).toBeNull();
    expect(stats.insufficientSample).toBe(true);
  });

  it("counts a no_trade row whose hypothetical trade would have hit TP1 as wouldHaveWon", () => {
    const map = new Map([["EUR/USD|H1", tpHitCandles()]]);
    const input: AnalyticsInput = {
      items: [makeItem()],
      forwardCandles: map,
      maxHoldingBars: 10,
    };
    const stats = computeNoTradeQuality(input);
    expect(stats.total).toBe(1);
    expect(stats.wouldHaveWon).toBe(1);
    expect(stats.wouldHaveLost).toBe(0);
    expect(stats.missRate).toBe(1);
  });

  it("counts a hypothetical SL hit as wouldHaveLost (correct skip)", () => {
    const map = new Map([["EUR/USD|H1", slHitCandles()]]);
    const input: AnalyticsInput = {
      items: [makeItem()],
      forwardCandles: map,
      maxHoldingBars: 10,
    };
    const stats = computeNoTradeQuality(input);
    expect(stats.wouldHaveWon).toBe(0);
    expect(stats.wouldHaveLost).toBe(1);
    expect(stats.missRate).toBe(0);
  });

  it("buckets expirations separately and excludes them from missRate", () => {
    const map = new Map([["EUR/USD|H1", expiredCandles()]]);
    const input: AnalyticsInput = {
      items: [makeItem()],
      forwardCandles: map,
      maxHoldingBars: 24,
    };
    const stats = computeNoTradeQuality(input);
    expect(stats.wouldHaveExpired).toBe(1);
    expect(stats.wouldHaveWon).toBe(0);
    expect(stats.wouldHaveLost).toBe(0);
    expect(stats.missRate).toBeNull();
  });

  it("counts no_trade rows with no forward candles as unresolved", () => {
    const input: AnalyticsInput = {
      items: [makeItem()],
      forwardCandles: new Map(),
      maxHoldingBars: 10,
    };
    const stats = computeNoTradeQuality(input);
    expect(stats.unresolved).toBe(1);
    expect(stats.wouldHaveWon).toBe(0);
  });
});
