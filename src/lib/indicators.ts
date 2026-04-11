// src/lib/indicators.ts
// Pure indicator calculation functions — no React or chart library dependency.
// Follows the pattern of src/lib/pip-value.ts.

import type { OHLCVCandle } from "@/types/trading";

// ── Types ───────────────────────────────────────────────────────

export interface TimeValue {
  time: string;
  value: number;
}

// ── EMA ─────────────────────────────────────────────────────────

/**
 * Calculate Exponential Moving Average from ascending OHLCV candles.
 *
 * Algorithm:
 *  1. Seed with SMA of the first `period` candles.
 *  2. For each subsequent candle, apply: EMA = price × k + prevEMA × (1 − k)
 *     where k = 2 / (period + 1).
 *
 * Returns TimeValue[] starting from the `period`-th candle (index period − 1).
 * Returns an empty array if candles.length < period.
 *
 * @param candles  Ascending-sorted OHLCV candles (as returned by useCandles)
 * @param period   EMA lookback period (e.g. 20, 50, 200)
 * @param field    Which price field to use (default: "close")
 */
export function calculateEMA(
  candles: OHLCVCandle[],
  period: number,
  field: "close" | "open" | "high" | "low" = "close",
): TimeValue[] {
  if (candles.length < period || period <= 0) return [];

  const k = 2 / (period + 1);
  const result: TimeValue[] = [];

  // Seed: SMA of first `period` candles
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i][field];
  }
  let ema = sum / period;
  result.push({ time: candles[period - 1].candle_time, value: ema });

  // EMA for remaining candles
  for (let i = period; i < candles.length; i++) {
    ema = candles[i][field] * k + ema * (1 - k);
    result.push({ time: candles[i].candle_time, value: ema });
  }

  return result;
}
