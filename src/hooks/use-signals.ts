import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { mockPairAnalysis } from "@/data/mockMarketData";
import type { Signal, EnrichedSignal } from "@/types/trading";

function computeRR(entry: number, sl: number, tp1: number): number {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return Math.round((Math.abs(tp1 - entry) / risk) * 100) / 100;
}

export function useSignals() {
  const { user } = useAuth();

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
    return query.data.map((s) => ({
      ...s,
      analysis: mockPairAnalysis[s.pair] ?? null,
      riskReward: computeRR(Number(s.entry_price), Number(s.stop_loss), Number(s.take_profit_1)),
    }));
  }, [query.data]);

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
  return mockPairAnalysis[pair]?.setupQuality ?? null;
}
