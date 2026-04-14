import { describe, it, expect } from "vitest";
import {
  aggregateTradeAnalytics,
  filterRows,
} from "@/lib/trade-analytics/aggregate";
import type { TradeAnalyticsRow } from "@/lib/trade-analytics/types";
import type {
  ExecutedTrade,
  TradeAnalysisRow,
} from "@/types/trading";

// ── fixture builders ────────────────────────────────────────────

function makeTrade(overrides: Partial<ExecutedTrade> = {}): ExecutedTrade {
  return {
    id: "trade-" + Math.random().toString(36).slice(2),
    user_id: "u",
    account_id: "acct-1",
    account_mode: "demo",
    signal_id: "sig-1",
    symbol: "EUR/USD",
    direction: "long",
    planned_entry_low: 1.08,
    planned_entry_high: 1.081,
    planned_stop_loss: 1.076,
    planned_take_profit_1: 1.0905,
    planned_take_profit_2: null,
    planned_confidence: 75,
    planned_setup_type: "breakout",
    planned_timeframe: "H1",
    planned_reasoning_snapshot: null,
    actual_entry_price: 1.0805,
    actual_stop_loss: 1.076,
    actual_take_profit: 1.0905,
    actual_exit_price: 1.0905,
    lot_size: 0.1,
    position_size: null,
    opened_at: "2026-04-10T10:00:00Z",
    closed_at: "2026-04-10T14:00:00Z",
    result_status: "win",
    pnl: 50,
    pnl_percent: 0.5,
    broker_position_id: null,
    notes: null,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T14:00:00Z",
    ...overrides,
  };
}

function makeAnalysis(
  tradeId: string,
  overrides: Partial<TradeAnalysisRow> = {},
): TradeAnalysisRow {
  return {
    id: "analysis-" + tradeId,
    user_id: "u",
    executed_trade_id: tradeId,
    flags: ["followed_plan"],
    details: {},
    signal_quality_score: 80,
    execution_quality_score: 100,
    discipline_score: 100,
    risk_management_score: 100,
    primary_outcome_reason: "won_per_plan",
    improvement_actions: [],
    rule_version: "v1",
    created_at: "2026-04-10T14:00:00Z",
    updated_at: "2026-04-10T14:00:00Z",
    ...overrides,
  };
}

function makeRow(
  tradeOverrides: Partial<ExecutedTrade> = {},
  analysisOverrides: Partial<TradeAnalysisRow> | null = {},
  reviewOverrides: Partial<Pick<TradeAnalyticsRow, "followedPlan" | "mistakeTags">> = {},
): TradeAnalyticsRow {
  const trade = makeTrade(tradeOverrides);
  const analysis =
    analysisOverrides === null ? null : makeAnalysis(trade.id, analysisOverrides);
  // Destructuring defaults (vs ??) so callers can explicitly pass
  // followedPlan: null and have that null propagate through.
  const { followedPlan = true, mistakeTags = [] } = reviewOverrides;
  return {
    trade,
    analysis,
    followedPlan,
    mistakeTags,
  };
}

// ── tests ───────────────────────────────────────────────────────

describe("aggregateTradeAnalytics — empty", () => {
  it("returns zeroed summary on an empty input", () => {
    const out = aggregateTradeAnalytics([]);
    expect(out.summary.totalTrades).toBe(0);
    expect(out.summary.winRate).toBe(0);
    expect(out.summary.avgPnlUsd).toBeNull();
    expect(out.byOutcome).toEqual([]);
    expect(out.topMistakeTags).toEqual([]);
    expect(out.signalVsExecutionMatrix).toEqual({
      highSignalHighExec: 0,
      highSignalLowExec: 0,
      lowSignalHighExec: 0,
      lowSignalLowExec: 0,
    });
  });
});

describe("aggregateTradeAnalytics — summary math", () => {
  it("computes wins, losses, win rate, total pnl and averages correctly", () => {
    const rows = [
      makeRow({ pnl: 100, result_status: "win" }),
      makeRow({ pnl: -50, result_status: "loss" }, {
        primary_outcome_reason: "lost_per_plan",
      }),
      makeRow({ pnl: 25, result_status: "win" }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.summary.totalTrades).toBe(3);
    expect(out.summary.closedTrades).toBe(3);
    expect(out.summary.wins).toBe(2);
    expect(out.summary.losses).toBe(1);
    expect(out.summary.winRate).toBe(67); // 2/3 = 66.67 -> rounds to 67
    expect(out.summary.totalPnlUsd).toBe(75);
    expect(out.summary.avgPnlUsd).toBe(25);
  });

  it("excludes open trades from win-rate denominator", () => {
    const rows = [
      makeRow({ result_status: "win", pnl: 50 }),
      makeRow({ result_status: "open", pnl: null, closed_at: null }),
      makeRow({ result_status: "open", pnl: null, closed_at: null }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.summary.totalTrades).toBe(3);
    expect(out.summary.openTrades).toBe(2);
    expect(out.summary.closedTrades).toBe(1);
    expect(out.summary.winRate).toBe(100); // 1 win / 1 closed
  });

  it("computes plan-adherence rate across rows that have a self-report", () => {
    const rows = [
      makeRow({}, {}, { followedPlan: true }),
      makeRow({}, {}, { followedPlan: false }),
      makeRow({}, {}, { followedPlan: null }), // unscored, ignored
    ];
    const out = aggregateTradeAnalytics(rows);
    // 1 of 2 reported = 0.5
    expect(out.summary.planAdherenceRate).toBe(0.5);
  });

  it("computes mean entry drift in pips, only for rows with a planned zone", () => {
    const rows = [
      // Inside zone — drift 0
      makeRow({
        actual_entry_price: 1.0805,
        planned_entry_low: 1.08,
        planned_entry_high: 1.081,
      }),
      // 30 pips above the zone high — drift 30
      makeRow({
        actual_entry_price: 1.084,
        planned_entry_low: 1.08,
        planned_entry_high: 1.081,
      }),
      // Manual trade — no zone, excluded from the drift mean
      makeRow({
        signal_id: null,
        actual_entry_price: 1.09,
        planned_entry_low: null,
        planned_entry_high: null,
      }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.summary.avgEntryDriftPips).not.toBeNull();
    // (0 + 30) / 2 = 15
    expect(Math.round(out.summary.avgEntryDriftPips!)).toBe(15);
  });
});

describe("aggregateTradeAnalytics — mode and source breakdowns", () => {
  it("splits demo and real into independent buckets", () => {
    const rows = [
      makeRow({ account_mode: "demo", result_status: "win", pnl: 100 }),
      makeRow({ account_mode: "demo", result_status: "loss", pnl: -50 }),
      makeRow({ account_mode: "real", result_status: "win", pnl: 200 }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.byMode.demo.totalTrades).toBe(2);
    expect(out.byMode.demo.wins).toBe(1);
    expect(out.byMode.real.totalTrades).toBe(1);
    expect(out.byMode.real.wins).toBe(1);
    expect(out.byMode.real.totalPnlUsd).toBe(200);
  });

  it("splits linked and manual into independent buckets", () => {
    const rows = [
      makeRow({ signal_id: "sig-a", result_status: "win", pnl: 50 }),
      makeRow({ signal_id: null, result_status: "loss", pnl: -25 }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.bySource.linked.totalTrades).toBe(1);
    expect(out.bySource.linked.winRate).toBe(100);
    expect(out.bySource.manual.totalTrades).toBe(1);
    expect(out.bySource.manual.winRate).toBe(0);
  });
});

describe("aggregateTradeAnalytics — outcome and mistake bars", () => {
  it("counts trades per primary_outcome_reason and sorts desc", () => {
    const rows = [
      makeRow({}, { primary_outcome_reason: "won_per_plan" }),
      makeRow({}, { primary_outcome_reason: "won_per_plan" }),
      makeRow({}, { primary_outcome_reason: "lost_per_plan" }),
      makeRow({}, { primary_outcome_reason: "lost_to_execution_drift" }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.byOutcome.length).toBe(3);
    expect(out.byOutcome[0].key).toBe("won_per_plan");
    expect(out.byOutcome[0].count).toBe(2);
  });

  it("counts mistake tags across all rows and caps to top 5", () => {
    const rows = [
      makeRow({}, {}, { mistakeTags: ["fomo_entry", "oversized"] }),
      makeRow({}, {}, { mistakeTags: ["fomo_entry"] }),
      makeRow({}, {}, { mistakeTags: ["revenge_trade"] }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.topMistakeTags[0].key).toBe("fomo_entry");
    expect(out.topMistakeTags[0].count).toBe(2);
    // Three distinct tags total, all returned (cap is 5)
    expect(out.topMistakeTags.length).toBe(3);
  });

  it("uses the human label from the mistake-tag table, not the raw code", () => {
    const rows = [
      makeRow({}, {}, { mistakeTags: ["fomo_entry"] }),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.topMistakeTags[0].label).toBe("FOMO entry");
  });
});

describe("aggregateTradeAnalytics — signal vs execution matrix", () => {
  it("classifies each scored trade into the correct quadrant", () => {
    const rows = [
      makeRow(
        { id: "a" },
        { signal_quality_score: 90, execution_quality_score: 90 },
      ),
      makeRow(
        { id: "b" },
        { signal_quality_score: 90, execution_quality_score: 50 },
      ),
      makeRow(
        { id: "c" },
        { signal_quality_score: 60, execution_quality_score: 90 },
      ),
      makeRow(
        { id: "d" },
        { signal_quality_score: 40, execution_quality_score: 40 },
      ),
      // Manual / unscored — excluded from the matrix entirely
      makeRow({ id: "e", signal_id: null }, null),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.signalVsExecutionMatrix).toEqual({
      highSignalHighExec: 1,
      highSignalLowExec: 1,
      lowSignalHighExec: 1,
      lowSignalLowExec: 1,
    });
  });
});

describe("filterRows", () => {
  const rows = [
    makeRow({
      id: "demo-linked",
      account_mode: "demo",
      signal_id: "s",
      closed_at: "2026-04-05T00:00:00Z",
    }),
    makeRow({
      id: "real-linked",
      account_mode: "real",
      signal_id: "s",
      closed_at: "2026-04-10T00:00:00Z",
    }),
    makeRow({
      id: "real-manual",
      account_mode: "real",
      signal_id: null,
      closed_at: "2026-04-12T00:00:00Z",
    }),
  ];

  it("filters by mode", () => {
    expect(filterRows(rows, { mode: "real" })).toHaveLength(2);
  });

  it("filters by source", () => {
    expect(filterRows(rows, { source: "manual" })).toHaveLength(1);
    expect(filterRows(rows, { source: "linked" })).toHaveLength(2);
  });

  it("filters by date range using closed_at when present", () => {
    const out = filterRows(rows, {
      since: "2026-04-08T00:00:00Z",
      until: "2026-04-13T00:00:00Z",
    });
    expect(out.map((r) => r.trade.id).sort()).toEqual(["real-linked", "real-manual"]);
  });

  it("composes multiple filters with logical AND", () => {
    const out = filterRows(rows, { mode: "real", source: "linked" });
    expect(out).toHaveLength(1);
    expect(out[0].trade.id).toBe("real-linked");
  });
});
