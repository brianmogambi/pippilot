import type { Tables } from "@/integrations/supabase/types";
import type { PairAnalysis } from "@/data/mockMarketData";

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

// ── Mock-only types (will be replaced by real APIs) ─────────────
export type { MarketData, PairAnalysis, TrendDirection, VolatilityLevel, SessionName, MarketStructure, SetupQuality, Verdict } from "@/data/mockMarketData";

export interface MarketSummary {
  pair: string;
  price: number;
  change: number;
  changePct: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

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
