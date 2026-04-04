import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMarketData as getMockMarketData, getPairAnalysis as getMockPairAnalysis } from "@/data/mockMarketData";
import { mockMarketSummary } from "@/data/mockSignals";
import type { MarketData, PairAnalysis, MarketSummary, VolatilityLevel, TrendDirection, SessionName, MarketStructure } from "@/types/trading";

// ── Map a market_data_cache DB row to the MarketData interface ──

function rowToMarketData(row: Record<string, unknown>): MarketData {
  return {
    symbol: row.symbol as string,
    price: Number(row.price),
    spread: Number(row.spread),
    dailyChange: Number(row.daily_change),
    dailyChangePct: Number(row.daily_change_pct),
    atr: Number(row.atr),
    volatility: (row.volatility as VolatilityLevel) ?? "Low",
    trendH1: (row.trend_h1 as TrendDirection) ?? "neutral",
    trendH4: (row.trend_h4 as TrendDirection) ?? "neutral",
    trendD1: (row.trend_d1 as TrendDirection) ?? "neutral",
    activeSession: (row.active_session as SessionName) ?? "Closed",
    newsRisk: Boolean(row.news_risk),
    supportLevel: Number(row.support_level),
    resistanceLevel: Number(row.resistance_level),
    sessionHigh: Number(row.session_high),
    sessionLow: Number(row.session_low),
    prevDayHigh: Number(row.prev_day_high),
    prevDayLow: Number(row.prev_day_low),
    marketStructure: (row.market_structure as MarketStructure) ?? "ranging",
  };
}

function rowToMarketSummary(row: Record<string, unknown>): MarketSummary {
  const changePct = Number(row.daily_change_pct);
  return {
    pair: row.symbol as string,
    price: Number(row.price),
    change: Number(row.daily_change),
    changePct,
    sentiment: changePct > 0.1 ? "bullish" : changePct < -0.1 ? "bearish" : "neutral",
  };
}

// ── Hooks ───────────────────────────────────────────────────────

/**
 * Fetch all market data from cache. Falls back to mock data if the table
 * is empty (Edge Function hasn't run yet) or the query fails.
 */
export function useAllMarketData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["market-data-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_data_cache")
        .select("*");

      if (error) throw error;
      if (!data || data.length === 0) return null; // signal to use fallback
      return Object.fromEntries(
        data.map((row) => [row.symbol, rowToMarketData(row)]),
      ) as Record<string, MarketData>;
    },
    enabled: !!user,
    staleTime: 60_000, // 1 minute — data updates every ~5 min from Edge Function
  });
}

/**
 * Get MarketData for a single symbol.
 * Returns live data if available, falls back to mock.
 */
export function useMarketData(symbol: string): MarketData {
  const { data: allData } = useAllMarketData();

  if (allData && allData[symbol]) {
    return allData[symbol];
  }

  // Fallback to mock data while cache is empty
  return getMockMarketData(symbol);
}

/**
 * Get PairAnalysis for a symbol.
 * Currently still returns mock data — will be replaced in Step 3
 * when the signal generation engine produces real analyses.
 */
export function usePairAnalysis(symbol: string): PairAnalysis | null {
  return getMockPairAnalysis(symbol);
}

/**
 * Get market summary for dashboard.
 * Returns live data if available, falls back to mock.
 */
export function useMarketSummary(): MarketSummary[] {
  const { data: allData } = useAllMarketData();

  if (allData) {
    return Object.values(allData).map((md) => ({
      pair: md.symbol,
      price: md.price,
      change: md.dailyChange,
      changePct: md.dailyChangePct,
      sentiment: md.dailyChangePct > 0.1 ? "bullish" as const : md.dailyChangePct < -0.1 ? "bearish" as const : "neutral" as const,
    }));
  }

  // Fallback to mock
  return mockMarketSummary;
}
