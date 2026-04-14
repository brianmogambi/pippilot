// Phase 18.7: trade-performance analytics hook.
//
// Three Supabase queries — executed_trades, trade_analyses,
// trade_journal_entries (just the review-tag columns) — joined
// in-memory and handed to the pure aggregator. We deliberately
// avoid PostgREST embedded selects so the hook stays debuggable
// (each query failure shows up on its own row) and so future
// joins (broker positions, analytics views) can be added without
// touching the aggregation layer.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  aggregateTradeAnalytics,
  type TradeAnalyticsBreakdown,
  type TradeAnalyticsFilters,
  type TradeAnalyticsRow,
} from "@/lib/trade-analytics";
import type {
  ExecutedTrade,
  TradeAnalysisRow,
} from "@/types/trading";

interface JournalReviewSlice {
  executed_trade_id: string | null;
  followed_plan: boolean | null;
  mistake_tags: string[] | null;
}

/**
 * Headline hook. Fetches every executed trade for the current user
 * (closed + open + cancelled), joins to trade_analyses + the linked
 * journal entry's review fields, and runs aggregateTradeAnalytics()
 * with the supplied filters. The full row set is memoized so
 * filter-only changes (mode toggle, source toggle) recompute
 * locally without re-hitting Supabase.
 */
export function useTradeAnalytics(filters: TradeAnalyticsFilters = {}) {
  const { user } = useAuth();

  const tradesQuery = useQuery({
    queryKey: ["trade-analytics", "executed-trades", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executed_trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExecutedTrade[];
    },
    enabled: !!user,
  });

  const analysesQuery = useQuery({
    queryKey: ["trade-analytics", "trade-analyses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_analyses")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as TradeAnalysisRow[];
    },
    enabled: !!user,
  });

  const journalReviewsQuery = useQuery({
    queryKey: ["trade-analytics", "journal-reviews", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("executed_trade_id, followed_plan, mistake_tags")
        .eq("user_id", user!.id)
        .not("executed_trade_id", "is", null);
      if (error) throw error;
      return (data ?? []) as JournalReviewSlice[];
    },
    enabled: !!user,
  });

  const isLoading =
    tradesQuery.isLoading || analysesQuery.isLoading || journalReviewsQuery.isLoading;
  const isError =
    tradesQuery.isError || analysesQuery.isError || journalReviewsQuery.isError;

  // Build the flat row set once per fetch, then re-aggregate on
  // every filter change without re-hitting the network.
  const rows: TradeAnalyticsRow[] = useMemo(() => {
    const trades = tradesQuery.data ?? [];
    const analyses = analysesQuery.data ?? [];
    const journals = journalReviewsQuery.data ?? [];

    const analysisByTradeId = new Map<string, TradeAnalysisRow>();
    for (const a of analyses) analysisByTradeId.set(a.executed_trade_id, a);

    const reviewByTradeId = new Map<
      string,
      { followedPlan: boolean | null; mistakeTags: string[] }
    >();
    for (const j of journals) {
      if (!j.executed_trade_id) continue;
      reviewByTradeId.set(j.executed_trade_id, {
        followedPlan: j.followed_plan,
        mistakeTags: j.mistake_tags ?? [],
      });
    }

    return trades.map<TradeAnalyticsRow>((trade) => {
      const review = reviewByTradeId.get(trade.id);
      return {
        trade,
        analysis: analysisByTradeId.get(trade.id) ?? null,
        followedPlan: review?.followedPlan ?? null,
        mistakeTags: review?.mistakeTags ?? [],
      };
    });
  }, [tradesQuery.data, analysesQuery.data, journalReviewsQuery.data]);

  const breakdown: TradeAnalyticsBreakdown = useMemo(
    () => aggregateTradeAnalytics(rows, filters),
    [rows, filters],
  );

  return {
    breakdown,
    rows,
    isLoading,
    isError,
    refetch: () => {
      tradesQuery.refetch();
      analysesQuery.refetch();
      journalReviewsQuery.refetch();
    },
  };
}
