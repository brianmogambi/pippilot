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

// ── Enriched types (computed fields on top of DB rows) ──────────
export type EnrichedSignal = Signal & {
  analysis: PairAnalysis | null;
  riskReward: number;
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
