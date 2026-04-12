// Phase 11: Signal analytics — shared types.
//
// Pure module: no DB / network / UI dependencies. The analytics layer
// reuses `BacktestMetrics` and `SignalWithOutcome` from
// `src/lib/backtest/types.ts` so the same `computeMetrics()` function
// works for both backtest runs and live signals.

import type {
  BacktestCandle,
  BacktestMetrics,
  SignalWithOutcome,
} from "../backtest/types";

/** Minimum sample size before a breakdown row is considered statistically meaningful. */
export const MIN_SAMPLE_SIZE = 5;

/** Equity curve point — cumulative R after each chronological resolved trade. */
export interface EquityPoint {
  /** ISO timestamp of the trade's resolvedAt. */
  time: string;
  /** Cumulative R-multiple up to and including this trade. */
  equityR: number;
  /** Per-trade R contribution (for tooltip / debugging). */
  tradeR: number;
}

/** A confidence calibration bucket. */
export interface ConfidenceBucket {
  /** Inclusive lower bound (e.g. 0, 40, 60, 80). */
  minConfidence: number;
  /** Exclusive upper bound (e.g. 40, 60, 80, 101 for the top bucket). */
  maxConfidence: number;
  trades: number;
  wins: number;
  losses: number;
  /** Realized win rate for resolved trades in the bucket. 0 when no resolved trades. */
  winRate: number;
  /** Average R for trades in the bucket. */
  avgR: number;
  /** True when trades < MIN_SAMPLE_SIZE — caller should treat with low confidence. */
  insufficientSample: boolean;
}

/**
 * No-trade quality stats — answers "how often does our `verdict=no_trade`
 * filter actually save us from losers vs cost us winners?".
 *
 * For each `verdict=no_trade` row that has a recorded entry/SL/TP and
 * forward candles, we replay the resolver as if the trade had been taken,
 * then bucket the would-have-been outcome.
 */
export interface NoTradeQualityStats {
  /** Total no_trade rows considered (skipped if forward candles missing). */
  total: number;
  /** Hypothetical TP1+ hits — rows we'd have passed on but would have won. */
  wouldHaveWon: number;
  /** Hypothetical SL hits — rows we correctly avoided. */
  wouldHaveLost: number;
  /** Hypothetical expirations — neither TP nor SL within max holding window. */
  wouldHaveExpired: number;
  /** Skipped because there were no forward candles to replay. */
  unresolved: number;
  /** wouldHaveWon / (wouldHaveWon + wouldHaveLost) — null when denom = 0. */
  missRate: number | null;
  /** True when total < MIN_SAMPLE_SIZE. */
  insufficientSample: boolean;
}

/** Sample-size flag wrapper around an existing breakdown bucket. */
export interface GatedBreakdownStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  expectancyR: number;
  totalR: number;
  insufficientSample: boolean;
}

/** Win rate keyed by `${pair}|${timeframe}` — used for the per-pair × timeframe heatmap. */
export type PairTimeframeStats = Record<string, GatedBreakdownStats>;

export interface AnalyticsInput {
  items: SignalWithOutcome[];
  /**
   * Optional forward-candle lookup keyed by `${pair}|${timeframe}` used by
   * the no-trade-quality replay. When omitted, no-trade quality is reported
   * with total = unresolved = items.length.
   */
  forwardCandles?: Map<string, BacktestCandle[]>;
  /** Holding window in bars for the no-trade quality replay (must match the engine config). */
  maxHoldingBars?: number;
  /** Pip size lookup keyed by pair, used for pip math when replaying no_trade rows. */
  pipSize?: Record<string, number>;
}

export interface AnalyticsOutput {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  confidenceBuckets: ConfidenceBucket[];
  noTradeQuality: NoTradeQualityStats;
  /** Setup-type → gated breakdown (sample-size flag added). */
  setupRStats: Record<string, GatedBreakdownStats>;
  /** "${pair}|${timeframe}" → gated breakdown. */
  pairTimeframeStats: PairTimeframeStats;
  /**
   * Count of items whose `outcome.kind === "expired"` AND `barsToResolution`
   * was less than maxHoldingBars (i.e. the resolver ran out of forward
   * candles, suggesting an OHLCV data gap rather than a true expiration).
   */
  dataGapCount: number;
}
