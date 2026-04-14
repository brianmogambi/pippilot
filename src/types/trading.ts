import type { Tables } from "@/integrations/supabase/types";

// ── Domain types ────────────────────────────────────────────────
export type TrendDirection = "bullish" | "bearish" | "neutral";
export type VolatilityLevel = "Low" | "Med" | "High";
export type SessionName = "London" | "New York" | "Asia" | "Closed";
export type MarketStructure = "trending" | "ranging" | "breakout";
export type SetupQuality = "A+" | "A" | "B" | "C";
export type Verdict = "trade" | "no_trade";

export interface MarketData {
  symbol: string;
  price: number;
  spread: number;
  dailyChange: number;
  dailyChangePct: number;
  atr: number;
  volatility: VolatilityLevel;
  trendH1: TrendDirection;
  trendH4: TrendDirection;
  trendD1: TrendDirection;
  activeSession: SessionName;
  newsRisk: boolean;
  supportLevel: number;
  resistanceLevel: number;
  sessionHigh: number;
  sessionLow: number;
  prevDayHigh: number;
  prevDayLow: number;
  marketStructure: MarketStructure;
}

export interface PairAnalysis {
  setupType: string;
  direction: "long" | "short";
  entryZone: [number, number];
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confidence: number;
  setupQuality: SetupQuality;
  invalidation: string;
  beginnerExplanation: string;
  expertExplanation: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  noTradeReason: string | null;
  verdict: Verdict;
  // Phase 8: explanation metadata. All optional — legacy rows pre-date
  // these columns. The UI does not render them this phase; a future
  // phase can light up an "AI" / "Template" badge.
  explanationSource?: "ai" | "template" | null;
  explanationStatus?:
    | "ai_success"
    | "ai_failed"
    | "ai_skipped"
    | "template_only"
    | null;
  explanationModel?: string | null;
  explanationPromptVersion?: string | null;
  explanationGeneratedAt?: string | null;
  explanationErrorCode?: string | null;
}

export interface MarketSummary {
  pair: string;
  price: number;
  change: number;
  changePct: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

// ── DB Row aliases ──────────────────────────────────────────────
export type Signal = Tables<"signals">;
export type Alert = Tables<"alerts">;
export type JournalEntry = Tables<"trade_journal_entries">;
export type TradingAccount = Tables<"trading_accounts">;
export type UserRiskProfile = Tables<"user_risk_profiles">;
export type Instrument = Tables<"instruments">;
export type PairAnalysisRow = Tables<"pair_analyses">;

// ── Phase 1: Signal → Trade → Journal → AI review ───────────────
// Demo vs real classification. Source of truth lives on
// trading_accounts.account_mode and is snapshotted onto
// executed_trades.account_mode at insert time.
export type AccountMode = "demo" | "real";
export type ExecutedTrade = Tables<"executed_trades">;
export type TradeResultStatus =
  | "open"
  | "win"
  | "loss"
  | "breakeven"
  | "cancelled";

// ── Phase 14: Broker integration DB row aliases ────────────────
export type BrokerConnection = Tables<"broker_connections">;
export type SyncedAccount = Tables<"synced_accounts">;
export type OpenPosition = Tables<"open_positions">;
export type PendingOrder = Tables<"pending_orders">;
export type AccountSnapshot = Tables<"account_snapshots">;
export type SyncLog = Tables<"sync_logs">;

// ── Enriched types (computed fields on top of DB rows) ──────────
export type EnrichedSignal = Signal & {
  analysis: PairAnalysis | null;
  riskReward: number;
};

// ── Candle types ───────────────────────────────────────────────

export type CandleTimeframe = "5m" | "15m" | "1h" | "4h" | "1d";

export interface OHLCVCandle {
  symbol: string;
  timeframe: CandleTimeframe;
  candle_time: string;      // ISO 8601 timestamptz
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  fetched_at: string;        // ISO 8601 timestamptz
}

/** Maps PairDetail UI toggle values to DB enum values */
export const UI_TO_DB_TIMEFRAME: Record<string, CandleTimeframe> = {
  "5m": "5m",
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
};

// ── Journal stats (derived) ─────────────────────────────────────
export interface JournalStats {
  totalTrades: number;
  wins: number;
  winRate: number;
  avgPips: string;
  avgR: string;
  bestPair: string;
  worstPair: string;
}
