// Phase 18.5: barrel for the trade-analysis rule engine.
export { analyzeTrade, TRADE_ANALYSIS_RULE_VERSION } from "./analyze";
export type {
  PrimaryOutcomeReason,
  TradeAnalysisFlag,
  TradeAnalysisInput,
  TradeAnalysisOutput,
} from "./types";

// Phase 18.6: natural-language post-trade review.
export {
  summarizeAnalysis,
  summarizeAnalysisOutput,
  describeDriftFlags,
  describeSignalQuality,
} from "./summarize";
export type { SummarizeAnalysisInput, TradeReviewSummary } from "./summarize";
