import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { mockPairAnalysis } from "@/data/mockMarketData";
import type { Signal, EnrichedSignal, PairAnalysis, PairAnalysisRow } from "@/types/trading";

function computeRR(entry: number, sl: number, tp1: number): number {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return Math.round((Math.abs(tp1 - entry) / risk) * 100) / 100;
}

function rowToAnalysis(row: PairAnalysisRow): PairAnalysis {
  return {
    setupType: row.setup_type,
    direction: row.direction as "long" | "short",
    entryZone: [row.entry_zone_low, row.entry_zone_high],
    stopLoss: row.stop_loss,
    tp1: row.tp1,
    tp2: row.tp2 ?? 0,
    tp3: row.tp3 ?? 0,
    confidence: row.confidence,
    setupQuality: row.setup_quality as PairAnalysis["setupQuality"],
    invalidation: row.invalidation,
    beginnerExplanation: row.beginner_explanation,
    expertExplanation: row.expert_explanation,
    reasonsFor: row.reasons_for,
    reasonsAgainst: row.reasons_against,
    noTradeReason: row.no_trade_reason,
    verdict: row.verdict as "trade" | "no_trade",
  };
}

// Fetch latest pair_analyses keyed by pair
function usePairAnalyses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pair-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pair_analyses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Keep only the latest analysis per pair
      const byPair: Record<string, PairAnalysisRow> = {};
      for (const row of data) {
        if (!byPair[row.pair]) byPair[row.pair] = row as PairAnalysisRow;
      }
      return byPair;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useSignals() {
  const { user } = useAuth();
  const { data: analyses } = usePairAnalyses();

  const query = useQuery({
    queryKey: ["signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Signal[];
    },
    enabled: !!user,
  });

  const enriched: EnrichedSignal[] = useMemo(() => {
    if (!query.data) return [];
    return query.data.map((s) => {
      // Prefer real analysis from DB, fall back to mock
      const dbAnalysis = analyses?.[s.pair];
      const analysis = dbAnalysis ? rowToAnalysis(dbAnalysis) : (mockPairAnalysis[s.pair] ?? null);
      return {
        ...s,
        analysis,
        riskReward: computeRR(Number(s.entry_price), Number(s.stop_loss), Number(s.take_profit_1)),
      };
    });
  }, [query.data, analyses]);

  return { ...query, signals: query.data ?? [], enriched };
}

export function useActiveSignals(limit = 6) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["signals-active", limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("signals")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Signal[];
    },
    enabled: !!user,
  });
}

export function useSignalsByPair(pair: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["signals-pair", pair],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("pair", pair)
        .eq("status", "active");
      if (error) throw error;
      return data as Signal[];
    },
    enabled: !!user && !!pair,
  });
}

export function getQualityForSignal(pair: string): string | null {
  // This is called synchronously from filter logic, so it still
  // falls back to mock. The real quality is available via enriched signals.
  return mockPairAnalysis[pair]?.setupQuality ?? null;
}
