// Phase 11: Live signal → outcome resolver adapter (browser/test mirror).
//
// Identical logic to `supabase/functions/_shared/backtest/live-outcome-adapter.ts`
// — kept duplicated so the vitest suite under `src/lib/backtest/__tests__/`
// can import it without pulling in Deno-specific paths. Both files MUST
// stay in sync; the Phase 11 test asserts adapter parity.

import type { BacktestCandle, ResolverSignal } from "./types";

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

export function ohlcvRowsToCandles(rows: OhlcvCandleRow[]): BacktestCandle[] {
  return rows.map((r) => ({
    time: r.candle_time,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
  }));
}

export function normalizeDirection(d: string): "long" | "short" {
  if (d === "long" || d === "buy") return "long";
  return "short";
}

export function normalizeTimeframe(tf: string): "1h" | "4h" | "1d" {
  const t = tf.toLowerCase();
  if (t === "h1" || t === "1h") return "1h";
  if (t === "h4" || t === "4h") return "4h";
  return "1d";
}

export function pipSizeForPair(pair: string): number {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}
