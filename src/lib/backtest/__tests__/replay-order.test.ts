import { describe, it, expect } from "vitest";
import { runReplayForPair, type EngineFn } from "../replay-loop";
import type { BacktestCandle, PairCandleSet } from "../types";

const HOUR = 3600 * 1000;
const baseMs = Date.parse("2026-01-01T00:00:00Z");

function makeCandles(count: number): BacktestCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(baseMs + i * HOUR).toISOString(),
    open: 1.1 + i * 0.0001,
    high: 1.1 + i * 0.0001 + 0.0010,
    low: 1.1 + i * 0.0001 - 0.0010,
    close: 1.1 + i * 0.0001 + 0.0002,
  }));
}

const candles: PairCandleSet = {
  h1: makeCandles(50),
  h4: makeCandles(15),
  d1: makeCandles(5),
};

describe("runReplayForPair — ordering and no-lookahead", () => {
  it("emits signals in chronological order with cursor monotonically advancing", () => {
    // Stub engine: emit a no_trade verdict at bars 5, 15, 25 to avoid the
    // dedup lock so we observe full ordering of multiple emissions.
    let calls = 0;
    const callOrder: string[] = [];
    const stub: EngineFn = (_pair, sliced, cursorISO) => {
      calls++;
      callOrder.push(cursorISO);
      // Verify no-lookahead at every call: every sliced candle must be <= cursor.
      const cursorMs = Date.parse(cursorISO);
      for (const c of sliced.h1) {
        expect(Date.parse(c.time)).toBeLessThanOrEqual(cursorMs);
      }
      for (const c of sliced.h4) {
        expect(Date.parse(c.time)).toBeLessThanOrEqual(cursorMs);
      }
      for (const c of sliced.d1) {
        expect(Date.parse(c.time)).toBeLessThanOrEqual(cursorMs);
      }

      if (calls === 5 || calls === 15 || calls === 25) {
        return {
          pair: "EUR/USD",
          timeframe: "H1",
          direction: "long",
          setupType: "trend_pullback",
          setupQuality: "B",
          verdict: "no_trade",
          confidence: 50,
          entryPrice: sliced.h1[sliced.h1.length - 1].close,
          stopLoss: 1.0,
          tp1: 1.2, tp2: 1.3, tp3: 1.4,
          riskReward: 1.5,
          reasonsFor: [],
          reasonsAgainst: [],
          invalidation: "",
        };
      }
      return null;
    };

    const result = runReplayForPair(
      { pair: "EUR/USD", candles, pipSize: 0.0001 },
      {
        baseTimeframe: "1h",
        startDate: "2026-01-01T00:00:00Z",
        endDate: "2026-01-03T00:00:00Z",
        maxHoldingBars: 10,
      },
      stub,
    );

    expect(result.items).toHaveLength(3);
    const cursorTimes = result.items.map((i) => Date.parse(i.signal.cursorTime));
    for (let i = 1; i < cursorTimes.length; i++) {
      expect(cursorTimes[i]).toBeGreaterThan(cursorTimes[i - 1]);
    }

    // Engine call order is also strictly chronological.
    const callTimes = callOrder.map((t) => Date.parse(t));
    for (let i = 1; i < callTimes.length; i++) {
      expect(callTimes[i]).toBeGreaterThan(callTimes[i - 1]);
    }
  });

  it("dedup: while a trade is unresolved, no new signals are emitted for that pair", () => {
    let calls = 0;
    const stub: EngineFn = (_pair, sliced) => {
      calls++;
      // Always try to emit a TRADE verdict.
      const last = sliced.h1[sliced.h1.length - 1];
      return {
        pair: "EUR/USD",
        timeframe: "H1",
        direction: "long",
        setupType: "trend_pullback",
        setupQuality: "B",
        verdict: "trade",
        confidence: 70,
        entryPrice: last.close,
        stopLoss: last.close - 0.0050,
        tp1: last.close + 0.0075,
        tp2: last.close + 0.0125,
        tp3: last.close + 0.0200,
        riskReward: 1.5,
        reasonsFor: [],
        reasonsAgainst: [],
        invalidation: "",
      };
    };

    const result = runReplayForPair(
      { pair: "EUR/USD", candles, pipSize: 0.0001 },
      {
        baseTimeframe: "1h",
        startDate: "2026-01-01T00:00:00Z",
        endDate: "2026-01-03T00:00:00Z",
        maxHoldingBars: 5,
      },
      stub,
    );

    // With dedup, signals must not be emitted at every cursor.
    expect(result.items.length).toBeLessThan(50);
    expect(result.items.length).toBeGreaterThan(0);

    // All signals must be acted on (verdict trade) and resolved.
    for (const it of result.items) {
      expect(it.signal.verdict).toBe("trade");
      expect(["tp1_hit", "tp2_hit", "tp3_hit", "sl_hit", "expired", "no_entry"]).toContain(it.outcome.kind);
    }
  });
});
