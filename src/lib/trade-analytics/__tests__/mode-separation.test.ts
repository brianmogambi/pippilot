import { describe, it, expect } from "vitest";
import {
  aggregateTradeAnalytics,
  filterRows,
} from "@/lib/trade-analytics/aggregate";
import type { TradeAnalyticsRow } from "@/lib/trade-analytics/types";
import type { ExecutedTrade } from "@/types/trading";

/**
 * Phase 18.9: focused regression tests for the "demo vs real must
 * never silently combine" invariant. The base aggregate.test.ts
 * covers the happy path; this file pins the guardrails so a
 * future refactor cannot accidentally leak one mode into the
 * other's totals.
 */

function makeTrade(overrides: Partial<ExecutedTrade> = {}): ExecutedTrade {
  return {
    id: "t-" + Math.random().toString(36).slice(2),
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
    pnl: 100,
    pnl_percent: 0.5,
    broker_position_id: null,
    notes: null,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T14:00:00Z",
    ...overrides,
  };
}

function row(trade: ExecutedTrade): TradeAnalyticsRow {
  return { trade, analysis: null, followedPlan: true, mistakeTags: [] };
}

describe("account mode separation — invariant guards", () => {
  it("a real loss does not reduce the demo win-rate", () => {
    const rows = [
      row(makeTrade({ account_mode: "demo", result_status: "win", pnl: 100 })),
      row(makeTrade({ account_mode: "real", result_status: "loss", pnl: -200 })),
    ];
    const out = aggregateTradeAnalytics(rows);
    // Combined view is honest (1 win / 2 trades = 50%)
    expect(out.summary.winRate).toBe(50);
    // But the demo bucket sees only its own win (100%)
    expect(out.byMode.demo.winRate).toBe(100);
    expect(out.byMode.demo.totalTrades).toBe(1);
    // And the real bucket sees only its own loss (0%)
    expect(out.byMode.real.winRate).toBe(0);
    expect(out.byMode.real.totalTrades).toBe(1);
  });

  it("demo P&L does not bleed into real P&L totals", () => {
    const rows = [
      row(makeTrade({ account_mode: "demo", pnl: 500 })),
      row(makeTrade({ account_mode: "demo", pnl: 300 })),
      row(makeTrade({ account_mode: "real", pnl: -100 })),
    ];
    const out = aggregateTradeAnalytics(rows);
    expect(out.byMode.demo.totalPnlUsd).toBe(800);
    expect(out.byMode.real.totalPnlUsd).toBe(-100);
    // And the combined view sums honestly
    expect(out.summary.totalPnlUsd).toBe(700);
  });

  it("filtering by mode never returns a row of the other mode", () => {
    const rows = [
      row(makeTrade({ account_mode: "demo" })),
      row(makeTrade({ account_mode: "real" })),
      row(makeTrade({ account_mode: "real" })),
    ];
    const demoOnly = filterRows(rows, { mode: "demo" });
    const realOnly = filterRows(rows, { mode: "real" });
    expect(demoOnly.length).toBe(1);
    expect(demoOnly[0].trade.account_mode).toBe("demo");
    expect(realOnly.length).toBe(2);
    expect(realOnly.every((r) => r.trade.account_mode === "real")).toBe(true);
  });

  it("filtering by mode=demo when there are no demo trades returns empty, not all", () => {
    const rows = [
      row(makeTrade({ account_mode: "real" })),
      row(makeTrade({ account_mode: "real" })),
    ];
    expect(filterRows(rows, { mode: "demo" })).toHaveLength(0);
  });

  it("source + mode filters compose without silently dropping to OR", () => {
    const rows = [
      row(makeTrade({ account_mode: "demo", signal_id: "s" })),
      row(makeTrade({ account_mode: "demo", signal_id: null })),
      row(makeTrade({ account_mode: "real", signal_id: "s" })),
      row(makeTrade({ account_mode: "real", signal_id: null })),
    ];
    // "real linked" must return exactly one row
    const out = filterRows(rows, { mode: "real", source: "linked" });
    expect(out.length).toBe(1);
    expect(out[0].trade.account_mode).toBe("real");
    expect(out[0].trade.signal_id).toBe("s");
  });

  it("byMode demo and real are literally independent summaries, not slices of a shared numerator", () => {
    const rows = [
      row(makeTrade({ account_mode: "demo", result_status: "win", pnl: 50 })),
      row(makeTrade({ account_mode: "real", result_status: "loss", pnl: -50 })),
    ];
    const out = aggregateTradeAnalytics(rows);
    // This is the failure mode we care about: if the aggregator ever
    // short-circuits to "summary slices", demo.avgPnl would become
    // 0 ((50 + -50)/2). With proper separation, demo sees 50 and
    // real sees -50.
    expect(out.byMode.demo.avgPnlUsd).toBe(50);
    expect(out.byMode.real.avgPnlUsd).toBe(-50);
  });
});
