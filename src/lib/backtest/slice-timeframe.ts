// Phase 10: Lookahead-safe candle slicing.
// Given ascending-sorted candle arrays and a cursor time, return a slice
// containing ONLY candles whose close time is <= cursor. The slicer is the
// single point of enforcement for the no-lookahead invariant.

import type { BacktestCandle, PairCandleSet } from "./types";

/**
 * Binary search for the largest index `i` where `candles[i].time <= cursor`.
 * Returns -1 if no candle qualifies. Candles MUST be sorted ascending by time.
 */
export function findCursorIndex(
  candles: BacktestCandle[],
  cursorMs: number,
): number {
  let lo = 0;
  let hi = candles.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = Date.parse(candles[mid].time);
    if (t <= cursorMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/**
 * Return a slice of `candles` containing every bar with time <= cursor.
 * Pure: does not mutate input. Empty array if no candle qualifies.
 */
export function sliceCandlesAtCursor(
  candles: BacktestCandle[],
  cursorISO: string,
): BacktestCandle[] {
  if (candles.length === 0) return [];
  const cursorMs = Date.parse(cursorISO);
  const idx = findCursorIndex(candles, cursorMs);
  if (idx < 0) return [];
  return candles.slice(0, idx + 1);
}

/**
 * Slice all three timeframes at the same cursor. This is what the replay
 * loop calls before invoking the signal engine.
 */
export function sliceAtCursor(
  full: PairCandleSet,
  cursorISO: string,
): PairCandleSet {
  return {
    h1: sliceCandlesAtCursor(full.h1, cursorISO),
    h4: sliceCandlesAtCursor(full.h4, cursorISO),
    d1: sliceCandlesAtCursor(full.d1, cursorISO),
  };
}

/**
 * Return candles strictly AFTER the given cursor. Used by the outcome
 * resolver to walk forward without seeing the cursor bar itself.
 */
export function futureCandlesAfter(
  candles: BacktestCandle[],
  cursorISO: string,
): BacktestCandle[] {
  if (candles.length === 0) return [];
  const cursorMs = Date.parse(cursorISO);
  const idx = findCursorIndex(candles, cursorMs);
  // idx is the last bar at or before cursor; future starts at idx+1.
  return candles.slice(idx + 1);
}
