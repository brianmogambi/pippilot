import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import type { CandleTimeframe, OHLCVCandle } from "@/types/trading";

// ── Constants ────────────────────────────────────────────────────

/** React Query staleTime per timeframe (ms) */
const STALE_TIME: Record<CandleTimeframe, number> = {
  "5m": 60_000,       // 1 minute
  "15m": 120_000,     // 2 minutes
  "1h": 300_000,      // 5 minutes
  "4h": 900_000,      // 15 minutes
  "1d": 3_600_000,    // 1 hour
};

/** How old the newest candle can be before we trigger a fetch (ms) */
const STALENESS_THRESHOLD: Record<CandleTimeframe, number> = {
  "5m": 10 * 60_000,
  "15m": 30 * 60_000,
  "1h": 2 * 60 * 60_000,
  "4h": 8 * 60 * 60_000,
  "1d": 48 * 60 * 60_000,
};

const DEFAULT_LIMIT = 200;

// ── Row mapper ───────────────────────────────────────────────────
// ohlcv_candles is not in auto-generated Supabase types yet.
// TODO: Remove this cast after running `npx supabase gen types`.

function rowToCandle(row: Record<string, unknown>): OHLCVCandle {
  return {
    symbol: row.symbol as string,
    timeframe: row.timeframe as CandleTimeframe,
    candle_time: row.candle_time as string,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: row.volume != null ? Number(row.volume) : null,
    fetched_at: row.fetched_at as string,
  };
}

// ── Hook 1: useCandles ───────────────────────────────────────────
// Read latest N candles from ohlcv_candles. Returns ascending order.

export function useCandles(
  symbol: string,
  timeframe: CandleTimeframe,
  limit: number = DEFAULT_LIMIT,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["candles", symbol, timeframe, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ohlcv_candles")
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .order("candle_time", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Map rows and reverse to ascending order for chart consumption
      return (data as unknown as Record<string, unknown>[])
        .map(rowToCandle)
        .reverse();
    },
    enabled: !!user && !!symbol && !!timeframe,
    staleTime: STALE_TIME[timeframe],
  });
}

// ── Hook 2: useCandlesInRange ────────────────────────────────────
// Read candles within a specific date range.

export function useCandlesInRange(
  symbol: string,
  timeframe: CandleTimeframe,
  from: string,
  to: string,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["candles-range", symbol, timeframe, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ohlcv_candles")
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .gte("candle_time", from)
        .lte("candle_time", to)
        .order("candle_time", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return (data as unknown as Record<string, unknown>[]).map(rowToCandle);
    },
    enabled: !!user && !!symbol && !!timeframe && !!from && !!to,
    staleTime: STALE_TIME[timeframe],
  });
}

// ── Hook 3: useFetchCandles ──────────────────────────────────────
// Mutation that triggers the fetch-candles Edge Function.

export function useFetchCandles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      symbol: string;
      timeframe: CandleTimeframe;
      outputsize?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("fetch-candles", {
        body: params,
      });
      if (error) throw error;
      return data as { status: string; candles?: number; runId?: string };
    },
    onSuccess: (_data, variables) => {
      // Invalidate candle queries for this symbol+timeframe so they refetch
      queryClient.invalidateQueries({
        queryKey: ["candles", variables.symbol, variables.timeframe],
      });
      queryClient.invalidateQueries({
        queryKey: ["candles-range", variables.symbol, variables.timeframe],
      });
    },
  });
}

// ── Hook 4: useCandlesWithFetch ──────────────────────────────────
// Combined hook: reads from DB, auto-triggers Edge Function if stale.

export function useCandlesWithFetch(
  symbol: string,
  timeframe: CandleTimeframe,
  limit: number = DEFAULT_LIMIT,
) {
  const candlesQuery = useCandles(symbol, timeframe, limit);
  const fetchMutation = useFetchCandles();
  const lastFetchAttempt = useRef<number>(0);

  useEffect(() => {
    if (!symbol || !timeframe) return;
    if (fetchMutation.isPending) return;

    // Debounce: don't re-attempt within the staleness threshold
    const now = Date.now();
    if (now - lastFetchAttempt.current < STALENESS_THRESHOLD[timeframe]) return;

    const candles = candlesQuery.data;
    const isEmpty = !candles || candles.length === 0;
    const newest = candles?.[candles.length - 1];
    const isStale = isEmpty || !newest ||
      (now - new Date(newest.candle_time).getTime()) > STALENESS_THRESHOLD[timeframe];

    if (isStale) {
      lastFetchAttempt.current = now;
      fetchMutation.mutate({ symbol, timeframe });
    }
  }, [symbol, timeframe, candlesQuery.data, fetchMutation.isPending]);

  return {
    ...candlesQuery,
    isFetching: candlesQuery.isLoading || fetchMutation.isPending,
    fetchError: fetchMutation.error,
  };
}
