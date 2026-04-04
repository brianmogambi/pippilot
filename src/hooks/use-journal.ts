import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import type { JournalEntry, JournalStats } from "@/types/trading";
import { toast } from "sonner";

export function useJournalEntries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journal-entries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JournalEntry[];
    },
    enabled: !!user,
  });
}

export function useDashboardJournal(limit = 3) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-journal", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as JournalEntry[];
    },
    enabled: !!user,
  });
}

export function useJournalByPair(pair: string, limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journal-pair", pair],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .eq("pair", pair)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as JournalEntry[];
    },
    enabled: !!user && !!pair,
  });
}

export function useDashboardJournalStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journal-stats", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("trade_journal_entries").select("result_pips, status");
      if (!data || data.length === 0) return null;
      const closed = data.filter((e) => e.status === "closed");
      const wins = closed.filter((e) => (Number(e.result_pips) ?? 0) > 0).length;
      const totalPips = closed.reduce((sum, e) => sum + (Number(e.result_pips) ?? 0), 0);
      return {
        total: data.length,
        winRate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0,
        avgPL: closed.length > 0 ? Math.round(totalPips / closed.length) : 0,
      };
    },
    enabled: !!user,
  });
}

export function useJournalStats(entries: JournalEntry[]): JournalStats {
  return useMemo(() => {
    const closedEntries = entries.filter((e) => e.status === "closed" && e.result_pips != null);
    const totalTrades = closedEntries.length;
    const wins = closedEntries.filter((e) => (Number(e.result_pips) ?? 0) > 0).length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const avgPips = totalTrades > 0
      ? (closedEntries.reduce((a, e) => a + (Number(e.result_pips) ?? 0), 0) / totalTrades).toFixed(1)
      : "0";

    const rEntries = closedEntries.filter((e) => e.stop_loss != null && e.result_pips != null);
    const avgR = rEntries.length > 0
      ? (rEntries.reduce((a, e) => {
          const slDist = Math.abs(Number(e.entry_price) - Number(e.stop_loss ?? e.entry_price));
          return a + (slDist > 0 ? (Number(e.result_pips) ?? 0) / (slDist * 10000) : 0);
        }, 0) / rEntries.length).toFixed(2)
      : "—";

    const pairStats = closedEntries.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
      if (!acc[e.pair]) acc[e.pair] = { total: 0, count: 0 };
      acc[e.pair].total += Number(e.result_pips) ?? 0;
      acc[e.pair].count += 1;
      return acc;
    }, {});
    const pairAvgs = Object.entries(pairStats).map(([pair, s]) => ({ pair, avg: s.total / s.count }));
    pairAvgs.sort((a, b) => b.avg - a.avg);

    return {
      totalTrades,
      wins,
      winRate,
      avgPips,
      avgR,
      bestPair: pairAvgs[0]?.pair ?? "—",
      worstPair: pairAvgs[pairAvgs.length - 1]?.pair ?? "—",
    };
  }, [entries]);
}

export function useCreateJournalEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const row = { ...payload, user_id: user!.id } as any;
      const { error } = await supabase.from("trade_journal_entries").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      toast.success("Journal entry added");
    },
    onError: () => toast.error("Failed to add entry"),
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, any> }) => {
      const { error } = await supabase.from("trade_journal_entries").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      toast.success("Journal entry updated");
    },
    onError: () => toast.error("Failed to update entry"),
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trade_journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      toast.success("Entry deleted");
    },
    onError: () => toast.error("Failed to delete entry"),
  });
}
