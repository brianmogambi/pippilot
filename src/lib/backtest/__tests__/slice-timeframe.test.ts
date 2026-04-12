import { describe, it, expect } from "vitest";
import {
  findCursorIndex,
  futureCandlesAfter,
  sliceAtCursor,
  sliceCandlesAtCursor,
} from "../slice-timeframe";
import type { BacktestCandle, PairCandleSet } from "../types";

function makeCandles(times: string[]): BacktestCandle[] {
  return times.map((t, i) => ({
    time: t,
    open: 1 + i * 0.001,
    high: 1 + i * 0.001 + 0.0005,
    low: 1 + i * 0.001 - 0.0005,
    close: 1 + i * 0.001 + 0.0001,
  }));
}

const h1Times = [
  "2026-01-01T00:00:00Z",
  "2026-01-01T01:00:00Z",
  "2026-01-01T02:00:00Z",
  "2026-01-01T03:00:00Z",
  "2026-01-01T04:00:00Z",
];

describe("sliceCandlesAtCursor", () => {
  const candles = makeCandles(h1Times);

  it("returns empty when cursor is before any candle", () => {
    expect(sliceCandlesAtCursor(candles, "2025-12-31T00:00:00Z")).toEqual([]);
  });

  it("includes the candle whose time exactly equals the cursor", () => {
    const sliced = sliceCandlesAtCursor(candles, "2026-01-01T02:00:00Z");
    expect(sliced).toHaveLength(3);
    expect(sliced[sliced.length - 1].time).toBe("2026-01-01T02:00:00Z");
  });

  it("includes only the bars at or before a cursor that falls between bars", () => {
    const sliced = sliceCandlesAtCursor(candles, "2026-01-01T02:30:00Z");
    expect(sliced).toHaveLength(3);
    expect(sliced[sliced.length - 1].time).toBe("2026-01-01T02:00:00Z");
  });

  it("returns all candles when cursor is after the last candle", () => {
    const sliced = sliceCandlesAtCursor(candles, "2030-01-01T00:00:00Z");
    expect(sliced).toHaveLength(candles.length);
  });

  it("does not mutate the input", () => {
    const before = candles.map((c) => c.time).join(",");
    sliceCandlesAtCursor(candles, "2026-01-01T03:00:00Z");
    const after = candles.map((c) => c.time).join(",");
    expect(after).toBe(before);
  });
});

describe("findCursorIndex", () => {
  it("returns -1 for cursor before all candles", () => {
    expect(findCursorIndex(makeCandles(h1Times), 0)).toBe(-1);
  });
  it("returns last index for cursor after all candles", () => {
    expect(findCursorIndex(makeCandles(h1Times), Date.parse("2030-01-01T00:00:00Z"))).toBe(4);
  });
});

describe("sliceAtCursor (multi-timeframe)", () => {
  const full: PairCandleSet = {
    h1: makeCandles(h1Times),
    h4: makeCandles(["2026-01-01T00:00:00Z", "2026-01-01T04:00:00Z"]),
    d1: makeCandles(["2026-01-01T00:00:00Z"]),
  };

  it("slices all three timeframes consistently", () => {
    const sliced = sliceAtCursor(full, "2026-01-01T03:30:00Z");
    expect(sliced.h1).toHaveLength(4);
    expect(sliced.h4).toHaveLength(1);
    expect(sliced.d1).toHaveLength(1);
  });
});

describe("futureCandlesAfter", () => {
  const candles = makeCandles(h1Times);

  it("returns candles strictly after the cursor", () => {
    const future = futureCandlesAfter(candles, "2026-01-01T02:00:00Z");
    expect(future).toHaveLength(2);
    expect(future[0].time).toBe("2026-01-01T03:00:00Z");
  });

  it("returns empty when cursor is at or after last candle", () => {
    expect(futureCandlesAfter(candles, "2026-01-01T04:00:00Z")).toEqual([]);
  });
});

describe("no-lookahead invariant (randomized)", () => {
  // Property test: for 1000 random cursors against a large candle set,
  // the slicer must NEVER include a candle with time > cursor.
  it("never leaks future candles for any random cursor", () => {
    const N = 500;
    const baseMs = Date.parse("2026-01-01T00:00:00Z");
    const HOUR = 3600 * 1000;
    const candles: BacktestCandle[] = Array.from({ length: N }, (_, i) => ({
      time: new Date(baseMs + i * HOUR).toISOString(),
      open: 1, high: 1.001, low: 0.999, close: 1.0005,
    }));

    const minMs = baseMs - 5 * HOUR;
    const maxMs = baseMs + (N + 5) * HOUR;

    for (let trial = 0; trial < 1000; trial++) {
      const cursorMs = Math.floor(minMs + Math.random() * (maxMs - minMs));
      const cursorISO = new Date(cursorMs).toISOString();
      const sliced = sliceCandlesAtCursor(candles, cursorISO);
      if (sliced.length > 0) {
        const lastBarMs = Date.parse(sliced[sliced.length - 1].time);
        expect(lastBarMs).toBeLessThanOrEqual(cursorMs);
      }
      // future + sliced must equal full set with no overlap
      const future = futureCandlesAfter(candles, cursorISO);
      expect(sliced.length + future.length).toBe(N);
      if (future.length > 0) {
        expect(Date.parse(future[0].time)).toBeGreaterThan(cursorMs);
      }
    }
  });
});
