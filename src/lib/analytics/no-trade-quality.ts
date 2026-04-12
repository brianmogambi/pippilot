// Phase 11: No-trade quality evaluator.
//
// For each `verdict='no_trade'` row in the analytics input, replay the
// outcome resolver against forward candles as if we *had* taken the trade.
// This produces a deterministic answer to "how often does our no_trade
// filter actually save us from losses vs cost us winners?"
//
// Pure / deterministic — depends only on the existing
// `src/lib/backtest/outcome-resolver.ts`.

import { resolveOutcome } from "../backtest/outcome-resolver";
import type { ResolverSignal, SignalWithOutcome } from "../backtest/types";
import { MIN_SAMPLE_SIZE, type AnalyticsInput, type NoTradeQualityStats } from "./types";

const DEFAULT_PIP_SIZE_NON_JPY = 0.0001;
const DEFAULT_PIP_SIZE_JPY = 0.01;
const DEFAULT_MAX_HOLDING_BARS = 24;

export function computeNoTradeQuality(input: AnalyticsInput): NoTradeQualityStats {
  const noTradeRows = input.items.filter((i) => i.signal.verdict === "no_trade");

  let wouldHaveWon = 0;
  let wouldHaveLost = 0;
  let wouldHaveExpired = 0;
  let unresolved = 0;

  const maxBars = input.maxHoldingBars ?? DEFAULT_MAX_HOLDING_BARS;
  const candleMap = input.forwardCandles;

  for (const { signal } of noTradeRows) {
    const futureCandles = lookupForward(candleMap, signal.pair, signal.timeframe);
    if (!futureCandles || futureCandles.length === 0) {
      unresolved++;
      continue;
    }

    const resolverSignal: ResolverSignal = {
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      tp1: signal.tp1,
      tp2: signal.tp2,
      tp3: signal.tp3,
    };
    const pipSize = pipSizeFor(signal.pair, input.pipSize);

    const outcome = resolveOutcome(resolverSignal, futureCandles, {
      maxBars,
      pipSize,
    });

    switch (outcome.kind) {
      case "tp1_hit":
      case "tp2_hit":
      case "tp3_hit":
        wouldHaveWon++;
        break;
      case "sl_hit":
        wouldHaveLost++;
        break;
      case "expired":
        wouldHaveExpired++;
        break;
      case "no_entry":
      case "invalidated":
      case "entry_hit":
      default:
        unresolved++;
        break;
    }
  }

  const total = noTradeRows.length;
  const denom = wouldHaveWon + wouldHaveLost;
  const missRate = denom > 0 ? round(wouldHaveWon / denom, 4) : null;

  return {
    total,
    wouldHaveWon,
    wouldHaveLost,
    wouldHaveExpired,
    unresolved,
    missRate,
    insufficientSample: total < MIN_SAMPLE_SIZE,
  };
}

function lookupForward(
  map: AnalyticsInput["forwardCandles"],
  pair: string,
  timeframe: string,
) {
  if (!map) return null;
  return map.get(`${pair}|${timeframe}`) ?? null;
}

function pipSizeFor(pair: string, override?: Record<string, number>): number {
  if (override && override[pair] != null) return override[pair];
  return pair.includes("JPY") ? DEFAULT_PIP_SIZE_JPY : DEFAULT_PIP_SIZE_NON_JPY;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// Re-export the helper that mirrors `SignalWithOutcome.signal.cursorTime`
// position so tests can build inputs without importing analytics types.
export type { SignalWithOutcome };
