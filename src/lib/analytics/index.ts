// Phase 11: Signal analytics service — barrel + top-level `analyze()`.
//
// Pure aggregator. Wraps the existing `computeMetrics()` from
// `src/lib/backtest/metrics.ts` and augments its output with:
//   - equity curve  (computeEquityCurve)
//   - confidence calibration buckets (computeConfidenceBuckets)
//   - no-trade quality replay (computeNoTradeQuality)
//   - sample-size-gated setup + (pair × timeframe) breakdowns
//   - data-gap detection (expired trades that were cut short by missing
//     forward candles, suggesting a data ingestion gap)
//
// No DB / network. The query layer in `./queries.ts` adapts Supabase
// rows to the `SignalWithOutcome` shape this module consumes.

import { computeMetrics } from "../backtest/metrics";
import { computeEquityCurve } from "./equity-curve";
import { computeConfidenceBuckets } from "./confidence-calibration";
import { computeNoTradeQuality } from "./no-trade-quality";
import {
  computePairTimeframeStats,
  gateSetupBreakdown,
} from "./setup-r-stats";
import type { AnalyticsInput, AnalyticsOutput } from "./types";

const DEFAULT_MAX_HOLDING_BARS = 24;

export function analyze(input: AnalyticsInput): AnalyticsOutput {
  const { items } = input;
  const metrics = computeMetrics(items);

  const maxHoldingBars = input.maxHoldingBars ?? DEFAULT_MAX_HOLDING_BARS;

  // A trade is "data-gapped" when the resolver expired it before the
  // configured holding window — i.e. it ran out of forward candles, not
  // out of patience. Distinguish from honest expirations.
  let dataGapCount = 0;
  for (const { outcome } of items) {
    if (outcome.kind === "expired" && outcome.barsToResolution < maxHoldingBars) {
      dataGapCount++;
    }
  }

  return {
    metrics,
    equityCurve: computeEquityCurve(items),
    confidenceBuckets: computeConfidenceBuckets(items),
    noTradeQuality: computeNoTradeQuality(input),
    setupRStats: gateSetupBreakdown(metrics.breakdownBySetup),
    pairTimeframeStats: computePairTimeframeStats(items),
    dataGapCount,
  };
}

export { computeEquityCurve } from "./equity-curve";
export { computeConfidenceBuckets } from "./confidence-calibration";
export { computeNoTradeQuality } from "./no-trade-quality";
export {
  computePairTimeframeStats,
  gateSetupBreakdown,
} from "./setup-r-stats";
export * from "./types";
export {
  fetchBacktestSignalsWithOutcomes,
  fetchLiveSignalsWithOutcomes,
  fetchJournalOutcomes,
} from "./queries";
export type { LiveSignalFilters, JournalOutcome } from "./queries";
