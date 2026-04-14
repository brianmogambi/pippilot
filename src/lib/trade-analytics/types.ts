// Phase 18.7: trade-performance analytics types.
//
// Intentionally separate from src/lib/analytics/ which holds the
// Phase 11 SIGNAL analytics (backtest + live signal outcomes
// independent of whether any user actually traded them). Mixing
// the two would let journaled trade results corrupt raw signal
// model-performance reporting — which is exactly the failure mode
// Phase 18.7 was created to prevent.

import type {
  AccountMode,
  ExecutedTrade,
  TradeAnalysisRow,
  TradeResultStatus,
} from "@/types/trading";

/**
 * Compact "everything we need to aggregate one trade" shape. Built
 * by the hook layer from a join of executed_trades + trade_analyses
 * + (optional) the linked journal row, so the pure aggregator never
 * has to know about Supabase response shapes.
 */
export interface TradeAnalyticsRow {
  trade: ExecutedTrade;
  /** May be null for legacy trades closed before Phase 18.5. */
  analysis: TradeAnalysisRow | null;
  /** Optional review fields lifted from the linked journal entry. */
  followedPlan: boolean | null;
  mistakeTags: string[];
}

/** A single bar in any of the breakdown views. */
export interface BreakdownBar {
  key: string;
  label: string;
  count: number;
  /** Win count among the bar's trades. */
  wins: number;
  /** 0–100 win rate, computed when count > 0. */
  winRate: number;
}

/**
 * Headline numbers for the page's filtered set. Every field is
 * defined whether the set is empty or not — empty sets just return
 * zero values rather than null so the UI can render zeros instead
 * of branching everywhere.
 */
export interface TradeAnalyticsSummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgPnlUsd: number | null;
  totalPnlUsd: number | null;
  /** Mean absolute entry drift from the planned zone, in pips. */
  avgEntryDriftPips: number | null;
  /** Fraction of closed trades where followed_plan = true. */
  planAdherenceRate: number | null;
  /** Mean signal_quality_score across rows that have one. */
  avgSignalQuality: number | null;
  /** Mean execution_quality_score across rows that have one. */
  avgExecutionQuality: number | null;
}

/** Full breakdown bundle returned by aggregateTradeAnalytics(). */
export interface TradeAnalyticsBreakdown {
  summary: TradeAnalyticsSummary;
  byMode: Record<AccountMode, TradeAnalyticsSummary>;
  /** linked = signal_id != null, manual = signal_id is null */
  bySource: { linked: TradeAnalyticsSummary; manual: TradeAnalyticsSummary };
  /** Bar list sorted by count desc, capped at 6 entries. */
  byOutcome: BreakdownBar[];
  /** Top mistake tags by frequency across linked + manual trades. */
  topMistakeTags: BreakdownBar[];
  /**
   * 2x2 quadrant matrix of trades classified by signal_quality and
   * execution_quality. Threshold at 75 for "high". Only counts
   * linked trades (manual trades have no signal score).
   */
  signalVsExecutionMatrix: {
    highSignalHighExec: number;
    highSignalLowExec: number;
    lowSignalHighExec: number;
    lowSignalLowExec: number;
  };
}

export interface TradeAnalyticsFilters {
  mode?: AccountMode;
  /** "linked" filters to signal-linked trades, "manual" to manual. */
  source?: "linked" | "manual";
  /** Inclusive lower bound on closed_at (or opened_at for open). */
  since?: string;
  /** Exclusive upper bound on closed_at (or opened_at for open). */
  until?: string;
  /** Restrict to specific result statuses. Default: all. */
  resultStatuses?: TradeResultStatus[];
}
