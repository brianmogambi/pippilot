// Phase 18.7: pure aggregation over executed_trades + trade_analyses.
//
// No React, no Supabase. Takes a flat array of TradeAnalyticsRow
// (each row = one trade + its analysis + journal review fields) and
// computes the summary, mode/source breakdowns, outcome bars, mistake
// tag bars, and signal-vs-execution quadrant matrix.
//
// Lives next to src/lib/trade-analysis/ but is intentionally a
// separate module:
//   * trade-analysis = "what happened in this single trade?"
//   * trade-analytics = "what's happening across all my trades?"
// Mixing these would push UI rendering concerns into the rule engine
// and aggregation concerns into the per-trade summarizer.

import { pipMultiplier } from "@/lib/pip-value";
import type { AccountMode, TradeResultStatus } from "@/types/trading";
import type {
  BreakdownBar,
  TradeAnalyticsBreakdown,
  TradeAnalyticsFilters,
  TradeAnalyticsRow,
  TradeAnalyticsSummary,
} from "./types";

const QUADRANT_THRESHOLD = 75;

const OUTCOME_LABELS: Record<string, string> = {
  won_per_plan: "Won per plan",
  won_despite_execution_drift: "Won despite drift",
  lost_per_plan: "In-plan loss",
  lost_to_execution_drift: "Lost to drift",
  signal_invalidated: "Signal invalidated",
  breakeven: "Breakeven",
  manual_no_signal: "Manual",
  trade_not_yet_closed: "Still open",
  cancelled: "Cancelled",
};

const MISTAKE_TAG_LABELS: Record<string, string> = {
  late_entry: "Entered too late",
  early_entry: "Entered too early",
  moved_stop_loss: "Moved stop loss",
  moved_take_profit: "Moved take profit",
  oversized: "Oversized position",
  fomo_entry: "FOMO entry",
  revenge_trade: "Revenge trade",
  ignored_plan: "Ignored plan",
  ignored_risk_rules: "Ignored risk rules",
};

// ── helpers ─────────────────────────────────────────────────────

function emptySummary(): TradeAnalyticsSummary {
  return {
    totalTrades: 0,
    closedTrades: 0,
    openTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    avgPnlUsd: null,
    totalPnlUsd: null,
    avgEntryDriftPips: null,
    planAdherenceRate: null,
    avgSignalQuality: null,
    avgExecutionQuality: null,
  };
}

function meanOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function entryDriftPips(row: TradeAnalyticsRow): number | null {
  const t = row.trade;
  const low = t.planned_entry_low != null ? Number(t.planned_entry_low) : null;
  const high = t.planned_entry_high != null ? Number(t.planned_entry_high) : null;
  if (low == null || high == null) return null;
  const actual = Number(t.actual_entry_price);
  // Distance from the zone — zero when the fill landed inside it.
  let distance = 0;
  if (actual > high) distance = actual - high;
  else if (actual < low) distance = low - actual;
  return Math.abs(distance) * pipMultiplier(t.symbol);
}

// ── single-bucket summary builder ───────────────────────────────

function summarize(rows: TradeAnalyticsRow[]): TradeAnalyticsSummary {
  if (rows.length === 0) return emptySummary();

  const closed = rows.filter((r) => r.trade.result_status !== "open");
  const open = rows.length - closed.length;
  const wins = closed.filter((r) => r.trade.result_status === "win").length;
  const losses = closed.filter((r) => r.trade.result_status === "loss").length;
  const breakevens = closed.filter((r) => r.trade.result_status === "breakeven").length;

  const pnls = closed
    .map((r) => (r.trade.pnl != null ? Number(r.trade.pnl) : null))
    .filter((v): v is number => v != null);

  const drifts = rows
    .map((r) => entryDriftPips(r))
    .filter((v): v is number => v != null);

  const followedPlanRows = closed.filter((r) => r.followedPlan != null);
  const followedPlanRate =
    followedPlanRows.length > 0
      ? followedPlanRows.filter((r) => r.followedPlan === true).length /
        followedPlanRows.length
      : null;

  const sigQualities = closed
    .map((r) => r.analysis?.signal_quality_score ?? null)
    .filter((v): v is number => v != null);
  const execQualities = closed
    .map((r) => r.analysis?.execution_quality_score ?? null)
    .filter((v): v is number => v != null);

  const totalPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) : null;
  const winRate =
    closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

  return {
    totalTrades: rows.length,
    closedTrades: closed.length,
    openTrades: open,
    wins,
    losses,
    breakevens,
    winRate,
    avgPnlUsd: pnls.length > 0 ? totalPnl! / pnls.length : null,
    totalPnlUsd: totalPnl,
    avgEntryDriftPips: meanOrNull(drifts),
    planAdherenceRate: followedPlanRate,
    avgSignalQuality: meanOrNull(sigQualities),
    avgExecutionQuality: meanOrNull(execQualities),
  };
}

// ── filtering ───────────────────────────────────────────────────

export function filterRows(
  rows: TradeAnalyticsRow[],
  filters: TradeAnalyticsFilters,
): TradeAnalyticsRow[] {
  return rows.filter((r) => {
    const t = r.trade;
    if (filters.mode && t.account_mode !== filters.mode) return false;
    if (filters.source === "linked" && !t.signal_id) return false;
    if (filters.source === "manual" && t.signal_id) return false;
    if (filters.resultStatuses && filters.resultStatuses.length > 0) {
      if (!filters.resultStatuses.includes(t.result_status as TradeResultStatus)) {
        return false;
      }
    }
    const referenceTime = t.closed_at ?? t.opened_at;
    if (filters.since && referenceTime < filters.since) return false;
    if (filters.until && referenceTime >= filters.until) return false;
    return true;
  });
}

// ── breakdown builders ──────────────────────────────────────────

function buildOutcomeBars(rows: TradeAnalyticsRow[]): BreakdownBar[] {
  const counts = new Map<string, { count: number; wins: number }>();
  for (const r of rows) {
    const key = r.analysis?.primary_outcome_reason ?? "unscored";
    const bucket = counts.get(key) ?? { count: 0, wins: 0 };
    bucket.count += 1;
    if (r.trade.result_status === "win") bucket.wins += 1;
    counts.set(key, bucket);
  }
  return Array.from(counts.entries())
    .map(([key, v]) => ({
      key,
      label: OUTCOME_LABELS[key] ?? key,
      count: v.count,
      wins: v.wins,
      winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildMistakeTagBars(rows: TradeAnalyticsRow[]): BreakdownBar[] {
  const counts = new Map<string, { count: number; wins: number }>();
  for (const r of rows) {
    for (const tag of r.mistakeTags) {
      const bucket = counts.get(tag) ?? { count: 0, wins: 0 };
      bucket.count += 1;
      if (r.trade.result_status === "win") bucket.wins += 1;
      counts.set(tag, bucket);
    }
  }
  return Array.from(counts.entries())
    .map(([key, v]) => ({
      key,
      label: MISTAKE_TAG_LABELS[key] ?? key.replace(/_/g, " "),
      count: v.count,
      wins: v.wins,
      winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function buildSignalVsExecutionMatrix(
  rows: TradeAnalyticsRow[],
): TradeAnalyticsBreakdown["signalVsExecutionMatrix"] {
  let hh = 0,
    hl = 0,
    lh = 0,
    ll = 0;
  for (const r of rows) {
    const sig = r.analysis?.signal_quality_score;
    const exe = r.analysis?.execution_quality_score;
    // Manual trades and unscored trades drop out of the matrix.
    if (sig == null || exe == null) continue;
    const highSig = sig >= QUADRANT_THRESHOLD;
    const highExe = exe >= QUADRANT_THRESHOLD;
    if (highSig && highExe) hh += 1;
    else if (highSig && !highExe) hl += 1;
    else if (!highSig && highExe) lh += 1;
    else ll += 1;
  }
  return {
    highSignalHighExec: hh,
    highSignalLowExec: hl,
    lowSignalHighExec: lh,
    lowSignalLowExec: ll,
  };
}

// ── public entry point ─────────────────────────────────────────

export function aggregateTradeAnalytics(
  allRows: TradeAnalyticsRow[],
  filters: TradeAnalyticsFilters = {},
): TradeAnalyticsBreakdown {
  const rows = filterRows(allRows, filters);

  const demoRows = rows.filter((r) => r.trade.account_mode === "demo");
  const realRows = rows.filter((r) => r.trade.account_mode === "real");
  const linkedRows = rows.filter((r) => r.trade.signal_id != null);
  const manualRows = rows.filter((r) => r.trade.signal_id == null);

  return {
    summary: summarize(rows),
    byMode: {
      demo: summarize(demoRows),
      real: summarize(realRows),
    } as Record<AccountMode, TradeAnalyticsSummary>,
    bySource: {
      linked: summarize(linkedRows),
      manual: summarize(manualRows),
    },
    byOutcome: buildOutcomeBars(rows),
    topMistakeTags: buildMistakeTagBars(rows),
    signalVsExecutionMatrix: buildSignalVsExecutionMatrix(rows),
  };
}
