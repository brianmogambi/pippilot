// Phase 11: Live signal → outcome resolver adapter (Deno).
//
// Maps a live `signals` DB row + forward `ohlcv_candles` rows into the
// `ResolverSignal` + `BacktestCandle[]` shape consumed by the existing
// `outcome-resolver.ts`. Pure / deterministic — does not touch Supabase.
//
// Mirror of `src/lib/backtest/__tests__/live-outcome-adapter.test.ts`'s
// expected behavior, kept as a Deno-only module so the edge function can
// import it without pulling in DOM types.

import type { BacktestCandle, ResolverSignal } from "./types.ts";

export interface LiveSignalRow {
  id: string;
  pair: string;
  timeframe: string;
  direction: string;
  entry_price: number | string;
  stop_loss: number | string;
  take_profit_1: number | string;
  take_profit_2: number | string | null;
  take_profit_3: number | string | null;
  created_at: string;
}

export interface OhlcvCandleRow {
  candle_time: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

/**
 * Convert a live signal DB row into the resolver-friendly shape. The
 * resolver requires non-null tp2/tp3 — when the engine omitted them
 * we fall back to tp1 so the resolver still produces a valid outcome.
 */
export function liveRowToResolverSignal(r: LiveSignalRow): ResolverSignal {
  const tp1 = Number(r.take_profit_1);
  const tp2 = r.take_profit_2 != null ? Number(r.take_profit_2) : tp1;
  const tp3 = r.take_profit_3 != null ? Number(r.take_profit_3) : tp2;
  return {
    direction: normalizeDirection(r.direction),
    entryPrice: Number(r.entry_price),
    stopLoss: Number(r.stop_loss),
    tp1,
    tp2,
    tp3,
  };
}

/** Convert OHLCV DB rows into the resolver candle shape. */
export function ohlcvRowsToCandles(rows: OhlcvCandleRow[]): BacktestCandle[] {
  return rows.map((r) => ({
    time: r.candle_time,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
  }));
}

/**
 * The DB stores live direction as either "long"/"short" (engine output)
 * or — in some legacy admin paths — "buy"/"sell". Normalize to long/short.
 */
export function normalizeDirection(d: string): "long" | "short" {
  if (d === "long" || d === "buy") return "long";
  return "short";
}

/**
 * Map a timeframe string (e.g. "H1", "1h", "H4", "4h") to the canonical
 * lowercase form used by `ohlcv_candles.timeframe`.
 */
export function normalizeTimeframe(tf: string): "1h" | "4h" | "1d" {
  const t = tf.toLowerCase();
  if (t === "h1" || t === "1h") return "1h";
  if (t === "h4" || t === "4h") return "4h";
  return "1d";
}

/**
 * Pip size for the resolver's pips_result calc. Mirrors run-backtest's
 * pipSizeForPair() but without depending on pip-value.ts. JPY pairs use
 * 0.01; everything else (including XAU/USD per Phase 10 caveat) uses 0.0001.
 */
export function pipSizeForPair(pair: string): number {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}
