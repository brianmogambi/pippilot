// Phase 10: Signal lifecycle outcome resolver.
// Walks future candles bar-by-bar from a signal's cursor and determines the
// trade outcome (TP/SL/expired/invalidated). Pure and deterministic.

import type {
  BacktestCandle,
  ResolvedOutcome,
  ResolverSignal,
  ResolutionEvent,
} from "./types";

export interface ResolveOptions {
  maxBars: number; // expire after N bars with no resolution
  pipSize: number; // for converting price diff to pips
}

/**
 * Resolve the lifecycle of a single signal against forward candles.
 *
 * Rules (deterministic, documented in BACKTEST_ENGINE.md):
 *  - Entry fill: market entry filled at the next bar's open. (We do not
 *    model limit/zone orders in v1 — see Plan limitation #5.)
 *  - Per bar after entry, in priority order:
 *      long:  if low <= SL → sl_hit  (PESSIMISTIC for same-bar collisions)
 *             elif high >= TP3 → tp3_hit
 *             elif high >= TP2 → tp2_hit
 *             elif high >= TP1 → tp1_hit
 *      short: mirror
 *  - If both SL and a TP are touched in the same bar, SL wins (pessimistic).
 *    Without tick data we cannot know intrabar order; honest default.
 *  - After maxBars with no TP/SL hit → expired.
 *  - If no candles available after the cursor → no_entry / expired.
 */
export function resolveOutcome(
  signal: ResolverSignal,
  futureCandles: BacktestCandle[],
  opts: ResolveOptions,
): ResolvedOutcome {
  const path: ResolutionEvent[] = [];

  if (futureCandles.length === 0) {
    return {
      kind: "no_entry",
      entryHitAt: null,
      resolvedAt: new Date(0).toISOString(),
      barsToResolution: 0,
      exitPrice: null,
      rMultiple: null,
      pipsResult: null,
      path,
    };
  }

  // Step 1: market fill at next bar's open.
  const fillBar = futureCandles[0];
  const entryPrice = signal.entryPrice; // we treat market entries as filled at engine entry price
  const entryHitAt = fillBar.time;
  path.push({ barTime: fillBar.time, event: `entry filled @ ${entryPrice}` });

  const isLong = signal.direction === "long";
  const riskPerUnit = Math.abs(entryPrice - signal.stopLoss);

  // Walk forward starting from the fill bar itself — TPs/SLs can hit on
  // the same bar that filled the entry.
  const walkBars = futureCandles.slice(0, Math.min(opts.maxBars, futureCandles.length));

  for (let i = 0; i < walkBars.length; i++) {
    const bar = walkBars[i];

    if (isLong) {
      const slHit = bar.low <= signal.stopLoss;
      const tp3Hit = bar.high >= signal.tp3;
      const tp2Hit = bar.high >= signal.tp2;
      const tp1Hit = bar.high >= signal.tp1;

      if (slHit) {
        path.push({ barTime: bar.time, event: `SL hit @ ${signal.stopLoss}` });
        return finalize("sl_hit", signal.stopLoss, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp3Hit) {
        path.push({ barTime: bar.time, event: `TP3 hit @ ${signal.tp3}` });
        return finalize("tp3_hit", signal.tp3, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp2Hit) {
        path.push({ barTime: bar.time, event: `TP2 hit @ ${signal.tp2}` });
        return finalize("tp2_hit", signal.tp2, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp1Hit) {
        path.push({ barTime: bar.time, event: `TP1 hit @ ${signal.tp1}` });
        return finalize("tp1_hit", signal.tp1, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
    } else {
      const slHit = bar.high >= signal.stopLoss;
      const tp3Hit = bar.low <= signal.tp3;
      const tp2Hit = bar.low <= signal.tp2;
      const tp1Hit = bar.low <= signal.tp1;

      if (slHit) {
        path.push({ barTime: bar.time, event: `SL hit @ ${signal.stopLoss}` });
        return finalize("sl_hit", signal.stopLoss, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp3Hit) {
        path.push({ barTime: bar.time, event: `TP3 hit @ ${signal.tp3}` });
        return finalize("tp3_hit", signal.tp3, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp2Hit) {
        path.push({ barTime: bar.time, event: `TP2 hit @ ${signal.tp2}` });
        return finalize("tp2_hit", signal.tp2, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
      if (tp1Hit) {
        path.push({ barTime: bar.time, event: `TP1 hit @ ${signal.tp1}` });
        return finalize("tp1_hit", signal.tp1, entryPrice, riskPerUnit, isLong, entryHitAt, bar.time, i + 1, opts.pipSize, path);
      }
    }
  }

  // No resolution within max holding window → expired at last walked bar's close.
  const lastBar = walkBars[walkBars.length - 1];
  const exitPrice = lastBar.close;
  path.push({ barTime: lastBar.time, event: `expired @ close ${exitPrice}` });

  return finalize(
    "expired",
    exitPrice,
    entryPrice,
    riskPerUnit,
    isLong,
    entryHitAt,
    lastBar.time,
    walkBars.length,
    opts.pipSize,
    path,
  );
}

function finalize(
  kind: ResolvedOutcome["kind"],
  exitPrice: number,
  entryPrice: number,
  riskPerUnit: number,
  isLong: boolean,
  entryHitAt: string,
  resolvedAt: string,
  bars: number,
  pipSize: number,
  path: ResolutionEvent[],
): ResolvedOutcome {
  const rawDiff = exitPrice - entryPrice;
  const directional = isLong ? rawDiff : -rawDiff;
  const rMultiple = riskPerUnit > 0 ? directional / riskPerUnit : 0;
  const pipsResult = pipSize > 0 ? directional / pipSize : 0;

  return {
    kind,
    entryHitAt,
    resolvedAt,
    barsToResolution: bars,
    exitPrice,
    rMultiple: round(rMultiple, 4),
    pipsResult: round(pipsResult, 2),
    path,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
