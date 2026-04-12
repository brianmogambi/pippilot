import { describe, expect, it } from "vitest";
import {
  liveRowToResolverSignal,
  ohlcvRowsToCandles,
  normalizeDirection,
  normalizeTimeframe,
  pipSizeForPair,
  type LiveSignalRow,
  type OhlcvCandleRow,
} from "../live-outcome-adapter";
import { resolveOutcome } from "../outcome-resolver";

describe("liveRowToResolverSignal", () => {
  it("maps snake_case columns to the resolver shape", () => {
    const row: LiveSignalRow = {
      id: "abc",
      pair: "EUR/USD",
      timeframe: "H1",
      direction: "long",
      entry_price: "1.1000",
      stop_loss: "1.0950",
      take_profit_1: "1.1050",
      take_profit_2: "1.1080",
      take_profit_3: "1.1100",
      created_at: "2026-01-01T00:00:00Z",
    };
    const out = liveRowToResolverSignal(row);
    expect(out.direction).toBe("long");
    expect(out.entryPrice).toBeCloseTo(1.1, 5);
    expect(out.stopLoss).toBeCloseTo(1.095, 5);
    expect(out.tp1).toBeCloseTo(1.105, 5);
    expect(out.tp2).toBeCloseTo(1.108, 5);
    expect(out.tp3).toBeCloseTo(1.11, 5);
  });

  it("falls back tp2/tp3 to tp1 when null in DB", () => {
    const row: LiveSignalRow = {
      id: "x",
      pair: "EUR/USD",
      timeframe: "1h",
      direction: "short",
      entry_price: 1.1,
      stop_loss: 1.105,
      take_profit_1: 1.095,
      take_profit_2: null,
      take_profit_3: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const out = liveRowToResolverSignal(row);
    expect(out.direction).toBe("short");
    expect(out.tp1).toBe(1.095);
    expect(out.tp2).toBe(1.095);
    expect(out.tp3).toBe(1.095);
  });

  it("normalizes legacy buy/sell direction values", () => {
    expect(normalizeDirection("buy")).toBe("long");
    expect(normalizeDirection("sell")).toBe("short");
    expect(normalizeDirection("long")).toBe("long");
    expect(normalizeDirection("short")).toBe("short");
  });
});

describe("ohlcvRowsToCandles", () => {
  it("coerces string OHLC values to numbers and copies candle_time", () => {
    const rows: OhlcvCandleRow[] = [
      { candle_time: "2026-01-01T01:00:00Z", open: "1.1", high: "1.105", low: "1.099", close: "1.104" },
    ];
    const out = ohlcvRowsToCandles(rows);
    expect(out[0]).toEqual({
      time: "2026-01-01T01:00:00Z",
      open: 1.1,
      high: 1.105,
      low: 1.099,
      close: 1.104,
    });
  });
});

describe("normalizeTimeframe", () => {
  it("maps engine and DB casing to canonical lowercase form", () => {
    expect(normalizeTimeframe("H1")).toBe("1h");
    expect(normalizeTimeframe("1h")).toBe("1h");
    expect(normalizeTimeframe("H4")).toBe("4h");
    expect(normalizeTimeframe("4h")).toBe("4h");
    expect(normalizeTimeframe("D1")).toBe("1d");
    expect(normalizeTimeframe("1d")).toBe("1d");
  });
});

describe("pipSizeForPair", () => {
  it("uses 0.01 for JPY pairs and 0.0001 otherwise", () => {
    expect(pipSizeForPair("USD/JPY")).toBe(0.01);
    expect(pipSizeForPair("EUR/USD")).toBe(0.0001);
    expect(pipSizeForPair("XAU/USD")).toBe(0.0001);
  });
});

describe("end-to-end: adapter feeds resolver and produces correct outcome", () => {
  it("hits TP1 when forward candles cross above the long TP1 level", () => {
    const sig: LiveSignalRow = {
      id: "1",
      pair: "EUR/USD",
      timeframe: "H1",
      direction: "long",
      entry_price: 1.1,
      stop_loss: 1.095,
      take_profit_1: 1.105,
      take_profit_2: 1.108,
      take_profit_3: 1.11,
      created_at: "2026-01-01T00:00:00Z",
    };
    const candleRows: OhlcvCandleRow[] = [
      { candle_time: "2026-01-01T01:00:00Z", open: 1.1, high: 1.102, low: 1.099, close: 1.101 },
      { candle_time: "2026-01-01T02:00:00Z", open: 1.101, high: 1.106, low: 1.1, close: 1.106 },
    ];
    const resolverSig = liveRowToResolverSignal(sig);
    const candles = ohlcvRowsToCandles(candleRows);
    const out = resolveOutcome(resolverSig, candles, { maxBars: 24, pipSize: pipSizeForPair(sig.pair) });
    expect(out.kind).toBe("tp1_hit");
    expect(out.rMultiple).toBeGreaterThan(0);
  });

  it("hits SL on a same-bar collision (pessimistic rule)", () => {
    const sig: LiveSignalRow = {
      id: "2",
      pair: "EUR/USD",
      timeframe: "H1",
      direction: "long",
      entry_price: 1.1,
      stop_loss: 1.095,
      take_profit_1: 1.105,
      take_profit_2: 1.108,
      take_profit_3: 1.11,
      created_at: "2026-01-01T00:00:00Z",
    };
    // Single bar that touches both SL and TP1 — pessimistic rule says SL.
    const candleRows: OhlcvCandleRow[] = [
      { candle_time: "2026-01-01T01:00:00Z", open: 1.1, high: 1.106, low: 1.094, close: 1.1 },
    ];
    const out = resolveOutcome(
      liveRowToResolverSignal(sig),
      ohlcvRowsToCandles(candleRows),
      { maxBars: 24, pipSize: 0.0001 },
    );
    expect(out.kind).toBe("sl_hit");
  });

  it("hits SL on the upside for short signals", () => {
    const sig: LiveSignalRow = {
      id: "3",
      pair: "EUR/USD",
      timeframe: "H1",
      direction: "sell",
      entry_price: 1.1,
      stop_loss: 1.105,
      take_profit_1: 1.095,
      take_profit_2: 1.092,
      take_profit_3: 1.09,
      created_at: "2026-01-01T00:00:00Z",
    };
    const candleRows: OhlcvCandleRow[] = [
      { candle_time: "2026-01-01T01:00:00Z", open: 1.1, high: 1.108, low: 1.099, close: 1.108 },
    ];
    const out = resolveOutcome(
      liveRowToResolverSignal(sig),
      ohlcvRowsToCandles(candleRows),
      { maxBars: 24, pipSize: 0.0001 },
    );
    expect(out.kind).toBe("sl_hit");
  });
});
