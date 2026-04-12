// Phase 10: Backtest replay foundation — shared types.
// Pure module: no DB/network/UI dependencies. Mirrors live in
// supabase/functions/_shared/backtest/types.ts (Deno) — keep in sync.

export type BacktestTimeframe = "1h" | "4h" | "1d";

export type BacktestSetupType =
  | "trend_pullback"
  | "breakout_retest"
  | "range_reversal"
  | "momentum_breakout"
  | "sr_rejection";

export interface BacktestConfig {
  startDate: string; // ISO
  endDate: string; // ISO
  pairs: string[];
  timeframes: BacktestTimeframe[];
  setupTypesEnabled: BacktestSetupType[];
  baseTimeframe: "1h" | "4h"; // cursor step (resolution timeframe)
  maxHoldingBars: number; // expire unresolved trades after N base bars
  startingBalance: number; // not used in v1 R-multiple math; stored for Phase 11
  riskPerTradePct: number; // not used in v1 R-multiple math; stored for Phase 11
}

// Minimal OHLCV shape used by the resolver and slicer.
// Mirrors the engine OHLCV but uses `time` (ISO) for clarity in pure code.
// Adapter at the DB boundary maps `candle_time` → `time`.
export interface BacktestCandle {
  time: string; // ISO timestamp of bar close
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PairCandleSet {
  h1: BacktestCandle[];
  h4: BacktestCandle[];
  d1: BacktestCandle[];
}

export type OutcomeKind =
  | "entry_hit"
  | "tp1_hit"
  | "tp2_hit"
  | "tp3_hit"
  | "sl_hit"
  | "invalidated"
  | "expired"
  | "no_entry";

export interface ResolutionEvent {
  barTime: string;
  event: string;
}

export interface ResolvedOutcome {
  kind: OutcomeKind;
  entryHitAt: string | null;
  resolvedAt: string;
  barsToResolution: number;
  exitPrice: number | null;
  rMultiple: number | null;
  pipsResult: number | null;
  path: ResolutionEvent[];
}

// Subset of SignalOutput needed by the resolver — kept narrow so callers
// don't have to construct the entire SignalOutput in tests.
export interface ResolverSignal {
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
}

// What the replay loop persists per signal generation.
export interface BacktestSignalRow {
  pair: string;
  timeframe: string;
  direction: "long" | "short";
  setupType: string;
  setupQuality: string | null;
  verdict: "trade" | "no_trade";
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskReward: number;
  cursorTime: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  invalidation: string;
}

// Pairing of a generated signal with its resolved outcome — input to metrics.
export interface SignalWithOutcome {
  signal: BacktestSignalRow;
  outcome: ResolvedOutcome;
}

export interface BreakdownStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  expectancyR: number;
  totalR: number;
}

export interface BacktestMetrics {
  totalSignals: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  expectancyR: number;
  maxDrawdownR: number;
  profitFactor: number | null;
  breakdownByPair: Record<string, BreakdownStats>;
  breakdownBySetup: Record<string, BreakdownStats>;
  breakdownByTimeframe: Record<string, BreakdownStats>;
}
