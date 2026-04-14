// Phase 18.5: pure-function rule-engine types.
//
// No React, no Supabase. These types describe the deterministic
// comparison between what a signal planned and what the user
// actually did, so analyze() can run anywhere (unit tests, close
// dialog, future background recompute jobs) against the same
// primitive input shape.

import type { TradeResultStatus } from "@/types/trading";

/**
 * Canonical flag codes raised by the rule engine. New codes must
 * always be appended — never removed or renumbered — because they
 * are persisted in trade_analyses.flags and downstream consumers
 * (Phase 18.6 NL summarizer, Phase 18.7 analytics) rely on them.
 */
export type TradeAnalysisFlag =
  | "late_entry"
  | "early_entry"
  | "tighter_stop_than_plan"
  | "wider_stop_than_plan"
  | "reduced_rr"
  | "improved_rr"
  | "followed_plan"
  | "deviated_from_plan"
  | "setup_failed_normally"
  | "signal_invalidated"
  | "probable_execution_error";

/**
 * Canonical outcome bucket. Mirrors the check constraint on
 * trade_analyses.primary_outcome_reason.
 */
export type PrimaryOutcomeReason =
  | "won_per_plan"
  | "won_despite_execution_drift"
  | "lost_per_plan"
  | "lost_to_execution_drift"
  | "signal_invalidated"
  | "breakeven"
  | "manual_no_signal"
  | "trade_not_yet_closed"
  | "cancelled";

/**
 * Plain-object view of the fields analyze() needs. The caller is
 * responsible for extracting these from an executed_trades row +
 * optional journal row + optional live signal status.
 */
export interface TradeAnalysisInput {
  direction: "long" | "short";
  pair: string;

  /** Planned snapshot copied at take-trade time. All nullable — */
  /** a manual trade has no planned_* at all.                    */
  plannedEntryLow: number | null;
  plannedEntryHigh: number | null;
  plannedStopLoss: number | null;
  plannedTakeProfit1: number | null;
  plannedConfidence: number | null;

  /** What the user actually did. actualEntry is required. */
  actualEntry: number;
  actualStopLoss: number | null;
  actualTakeProfit: number | null;
  actualExit: number | null;

  resultStatus: TradeResultStatus;

  /** Optional review inputs copied from the linked journal row. */
  followedPlan?: boolean | null;
  mistakeTags?: string[];

  /** Whether the trade originated from an AI signal. False for manual. */
  signalLinked: boolean;

  /**
   * Optional live signal status (from signals.status) at analyze
   * time, used to detect the 'signal_invalidated' bucket. When the
   * caller doesn't have this info (e.g. a manual trade) pass null.
   */
  liveSignalStatus?: string | null;
}

export interface TradeAnalysisOutput {
  flags: TradeAnalysisFlag[];
  /** Per-flag context (deltas, thresholds). Persisted as jsonb. */
  details: Record<string, unknown>;
  signalQualityScore: number | null;
  executionQualityScore: number | null;
  disciplineScore: number | null;
  riskManagementScore: number | null;
  primaryOutcomeReason: PrimaryOutcomeReason;
  improvementActions: string[];
  ruleVersion: string;
}
