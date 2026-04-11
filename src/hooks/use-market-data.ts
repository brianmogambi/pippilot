import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PairAnalysisRow,
  MarketData,
  PairAnalysis,
  MarketSummary,
  VolatilityLevel,
  TrendDirection,
  SessionName,
  MarketStructure,
} from "@/types/trading";
import { freshnessOf, type Freshness } from "@/lib/data-freshness";
import { rowToAnalysis } from "./_shared/row-to-analysis";

/**
 * Map value augmentation: each cached symbol carries its own
 * `updated_at` timestamp at the map-value level so we don't have to
 * widen the shared `MarketData` interface in `src/types/trading.ts`
 * (which has dozens of consumers).
 */
export type MarketDataWithFreshness = MarketData & { updatedAt: string | null };
export type MarketDataMap = Record<string, MarketDataWithFreshness>;

// ── Map a market_data_cache DB row to the MarketData interface ──

function rowToMarketData(row: Record<string, unknown>): MarketDataWithFreshness {
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
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

// ── Hooks ───────────────────────────────────────────────────────

/**
 * Fetch all market data from cache.
 * Returns null when the cache is empty (Edge Function hasn't run yet).
 * No mock fallback — callers should render an empty state.
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
      if (!data || data.length === 0) return null;
      return Object.fromEntries(
        data.map((row) => [row.symbol, rowToMarketData(row)]),
      ) as MarketDataMap;
    },
    enabled: !!user,
    staleTime: 60_000, // 1 minute — data updates every ~5 min from Edge Function
  });
}

/**
 * Get MarketData + freshness for a single symbol.
 * Returns `data: null` and `freshness: "fallback"` when cache is empty.
 */
export function useMarketData(symbol: string): {
  data: MarketData | null;
  freshness: Freshness;
  updatedAt: string | null;
} {
  const { data: allData } = useAllMarketData();
  const row = allData?.[symbol] ?? null;
  const updatedAt = row?.updatedAt ?? null;
  return {
    data: row,
    freshness: freshnessOf(updatedAt, !!row),
    updatedAt,
  };
}

/**
 * Get the latest PairAnalysis for a symbol.
 * Returns null when no analysis exists yet.
 *
 * Phase 9: now uses the shared `rowToAnalysis` helper so the Phase 8
 * explanation metadata propagates to this consumer too.
 */
export function usePairAnalysis(symbol: string): PairAnalysis | null {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["pair-analysis", symbol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pair_analyses")
        .select("*")
        .eq("pair", symbol)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PairAnalysisRow | null;
    },
    enabled: !!user && !!symbol,
    staleTime: 60_000,
  });

  if (!data) return null;
  return rowToAnalysis(data);
}

/**
 * Get market summary for dashboard.
 * Returns empty array when cache is empty.
 */
export function useMarketSummary(): MarketSummary[] {
  const { data: allData } = useAllMarketData();

  if (!allData) return [];

  return Object.values(allData).map((md) => ({
    pair: md.symbol,
    price: md.price,
    change: md.dailyChange,
    changePct: md.dailyChangePct,
    sentiment:
      md.dailyChangePct > 0.1
        ? ("bullish" as const)
        : md.dailyChangePct < -0.1
        ? ("bearish" as const)
        : ("neutral" as const),
  }));
}
