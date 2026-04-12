// Phase 10: Backtest performance metrics aggregator. Deno mirror — keep
// in sync with src/lib/backtest/metrics.ts.
// Pure: takes signal+outcome rows and produces a metrics summary plus
// breakdowns by pair / setup / timeframe.

import type {
  BacktestMetrics,
  BreakdownStats,
  SignalWithOutcome,
} from "./types.ts";

const WIN_KINDS = new Set(["tp1_hit", "tp2_hit", "tp3_hit"]);
const LOSS_KINDS = new Set(["sl_hit"]);

function emptyBreakdown(): BreakdownStats {
  return {
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgR: 0,
    expectancyR: 0,
    totalR: 0,
  };
}

function finalizeBreakdown(stats: BreakdownStats): BreakdownStats {
  const resolved = stats.wins + stats.losses;
  stats.winRate = resolved > 0 ? round(stats.wins / resolved, 4) : 0;
  stats.avgR = stats.trades > 0 ? round(stats.totalR / stats.trades, 4) : 0;
  stats.expectancyR = stats.avgR; // unitless E[R] per trade
  stats.totalR = round(stats.totalR, 4);
  return stats;
}

export function computeMetrics(items: SignalWithOutcome[]): BacktestMetrics {
  const totalSignals = items.length;
  // A "trade" = signal that was acted on (verdict=trade AND entry was filled).
  // verdict=no_trade is counted in totalSignals but not in totalTrades.
  const trades = items.filter(
    (i) => i.signal.verdict === "trade" && i.outcome.kind !== "no_entry",
  );

  const byPair: Record<string, BreakdownStats> = {};
  const bySetup: Record<string, BreakdownStats> = {};
  const byTimeframe: Record<string, BreakdownStats> = {};

  let wins = 0;
  let losses = 0;
  let totalR = 0;
  let grossWinR = 0;
  let grossLossR = 0;

  // Track resolved trades in chronological order for max-drawdown calc.
  const chronological = [...trades].sort(
    (a, b) => Date.parse(a.signal.cursorTime) - Date.parse(b.signal.cursorTime),
  );

  for (const { signal, outcome } of chronological) {
    const r = outcome.rMultiple ?? 0;
    totalR += r;

    const isWin = WIN_KINDS.has(outcome.kind);
    const isLoss = LOSS_KINDS.has(outcome.kind);
    if (isWin) {
      wins++;
      grossWinR += r;
    }
    if (isLoss) {
      losses++;
      grossLossR += r; // negative R
    }

    addToBreakdown(byPair, signal.pair, r, isWin, isLoss);
    addToBreakdown(bySetup, signal.setupType, r, isWin, isLoss);
    addToBreakdown(byTimeframe, signal.timeframe, r, isWin, isLoss);
  }

  const totalTrades = trades.length;
  const resolved = wins + losses;
  const winRate = resolved > 0 ? round(wins / resolved, 4) : 0;
  const avgR = totalTrades > 0 ? round(totalR / totalTrades, 4) : 0;
  // Expectancy in R: average R per trade across all trades (resolved & open).
  const expectancyR = avgR;

  const profitFactor = grossLossR < 0
    ? round(grossWinR / Math.abs(grossLossR), 4)
    : grossWinR > 0
      ? Infinity
      : null;

  // Max drawdown in R: walk equity curve, peak − current, take max.
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const { outcome } of chronological) {
    equity += outcome.rMultiple ?? 0;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    totalSignals,
    totalTrades,
    wins,
    losses,
    winRate,
    avgR,
    expectancyR,
    maxDrawdownR: round(maxDd, 4),
    profitFactor: profitFactor === Infinity ? null : profitFactor,
    breakdownByPair: finalizeAll(byPair),
    breakdownBySetup: finalizeAll(bySetup),
    breakdownByTimeframe: finalizeAll(byTimeframe),
  };
}

function addToBreakdown(
  bucket: Record<string, BreakdownStats>,
  key: string,
  r: number,
  isWin: boolean,
  isLoss: boolean,
): void {
  if (!bucket[key]) bucket[key] = emptyBreakdown();
  const s = bucket[key];
  s.trades++;
  s.totalR += r;
  if (isWin) s.wins++;
  if (isLoss) s.losses++;
}

function finalizeAll(
  bucket: Record<string, BreakdownStats>,
): Record<string, BreakdownStats> {
  for (const key of Object.keys(bucket)) {
    finalizeBreakdown(bucket[key]);
  }
  return bucket;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
