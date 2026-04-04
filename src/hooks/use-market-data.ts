import { getMarketData, getPairAnalysis } from "@/data/mockMarketData";
import { mockMarketSummary } from "@/data/mockSignals";
import type { MarketData, PairAnalysis, MarketSummary } from "@/types/trading";

// These hooks wrap mock data functions. When a real market data API is
// integrated, only this file needs to change — no pages or components.

export function useMarketData(symbol: string): MarketData {
  return getMarketData(symbol);
}

export function usePairAnalysis(symbol: string): PairAnalysis | null {
  return getPairAnalysis(symbol);
}

export function useMarketSummary(): MarketSummary[] {
  return mockMarketSummary;
}
