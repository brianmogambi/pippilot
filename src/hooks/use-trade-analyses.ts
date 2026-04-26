// Phase 18.5: read + upsert hooks for trade_analyses.
//
// The rule engine itself lives in src/lib/trade-analysis/ and is
// pure. This module owns the Supabase plumbing — fetch, upsert and
// cache invalidation. The close-trade flow runs analyzeTrade() and
// hands the result to useUpsertTradeAnalysis(), which persists onto
// the unique executed_trade_id row (insert on first close, update
// on any later re-compute).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { TradeAnalysisRow } from "@/types/trading";
import type { TradeAnalysisOutput } from "@/lib/trade-analysis";

export type TradeAnalysisInsert = Omit<
  Database["public"]["Tables"]["trade_analyses"]["Insert"],
  "user_id"
>;

/**
 * Fetch the analysis row for a single executed trade. Returns null
 * when no analysis has been computed yet (the close flow may have
 * been skipped or a manual trade was logged outside the dialog).
 */
export function useTradeAnalysisForTrade(executedTradeId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trade-analyses", "by-trade", executedTradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_analyses")
        .select("*")
        .eq("executed_trade_id", executedTradeId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as TradeAnalysisRow | null;
    },
    enabled: !!user && !!executedTradeId,
  });
}

/**
 * Upsert (insert-or-update) by executed_trade_id. The migration
 * declares a UNIQUE constraint on that column so the conflict
 * target is unambiguous; this lets us re-run the engine on the
 * same trade without manual housekeeping.
 */
export function useUpsertTradeAnalysis() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TradeAnalysisInsert) => {
      const { error } = await supabase
        .from("trade_analyses")
        .upsert(
          { ...payload, user_id: user!.id },
          { onConflict: "executed_trade_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-analyses"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to persist post-trade analysis";
      // Soft failure — the trade is already closed/journaled, the
      // analysis is a derived artifact and can be recomputed later.
      toast.error(msg);
    },
  });
}

/**
 * Phase 18.5 helper: convert the pure engine output to the shape
 * trade_analyses.Insert expects. Lives next to the hook so callers
 * never have to remember the snake_case column names.
 */
export function tradeAnalysisOutputToInsert(
  executedTradeId: string,
  output: TradeAnalysisOutput,
): TradeAnalysisInsert {
  return {
    executed_trade_id: executedTradeId,
    flags: output.flags,
    details: output.details as never,
    signal_quality_score: output.signalQualityScore,
    execution_quality_score: output.executionQualityScore,
    discipline_score: output.disciplineScore,
    risk_management_score: output.riskManagementScore,
    primary_outcome_reason: output.primaryOutcomeReason,
    improvement_actions: output.improvementActions,
    rule_version: output.ruleVersion,
  };
}

// ── Phase 5 (improvement plan): learning-loop helpers ───────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface RecentLesson {
  /** trade_analysis row id, used for React keys. */
  id: string;
  /** First improvement action from the analysis — surfaced as the lesson. */
  action: string;
  /** Pair the lesson came from, for context ("EUR/USD: don't move the stop"). */
  pair: string | null;
  /** ISO timestamp the analysis was created. */
  createdAt: string;
}

/**
 * Last `limit` distinct improvement actions across the user's recent
 * trade_analyses, mode-scoped via the linked executed_trades row.
 *
 * Why two queries: trade_analyses has no account_mode of its own, so
 * we filter executed_trades first and then fetch the analyses for
 * those trade ids. Cheaper than a server-side join through PostgREST
 * for a 3-row dashboard widget.
 */
export function useRecentLessons(
  mode: "demo" | "real",
  limit: number = 3,
): { data: RecentLesson[]; isLoading: boolean } {
  const { user } = useAuth();
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const query = useQuery({
    queryKey: ["recent-lessons", user?.id, mode, limit],
    queryFn: async (): Promise<RecentLesson[]> => {
      const { data: trades, error: tradesError } = await supabase
        .from("executed_trades")
        .select("id, pair")
        .eq("user_id", user!.id)
        .eq("account_mode", mode)
        .gte("created_at", since);
      if (tradesError) throw tradesError;
      if (!trades || trades.length === 0) return [];

      const tradeIds = trades.map((t) => t.id);
      const tradeById = new Map(trades.map((t) => [t.id, t.pair as string | null]));

      const { data: analyses, error: aError } = await supabase
        .from("trade_analyses")
        .select("id, executed_trade_id, improvement_actions, created_at")
        .eq("user_id", user!.id)
        .in("executed_trade_id", tradeIds)
        .order("created_at", { ascending: false });
      if (aError) throw aError;

      const lessons: RecentLesson[] = [];
      const seenActions = new Set<string>();
      for (const a of analyses ?? []) {
        const actions = (a.improvement_actions ?? []) as string[];
        for (const action of actions) {
          const trimmed = action.trim();
          if (!trimmed || seenActions.has(trimmed)) continue;
          seenActions.add(trimmed);
          lessons.push({
            id: `${a.id}-${seenActions.size}`,
            action: trimmed,
            pair: tradeById.get(a.executed_trade_id as string) ?? null,
            createdAt: a.created_at as string,
          });
          break; // one lesson per analysis to keep variety
        }
        if (lessons.length >= limit) break;
      }
      return lessons;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return { data: query.data ?? [], isLoading: query.isLoading };
}

/**
 * How many of the user's other trade_analyses in the last 30 days share
 * a primary outcome reason with the given trade. Powers the
 * "you've seen this mistake before" badge on a journal entry.
 */
export function useRecurringOutcomeCount(
  executedTradeId: string | null | undefined,
  primaryOutcomeReason: string | null | undefined,
): number {
  const { user } = useAuth();
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const query = useQuery({
    queryKey: [
      "recurring-outcome",
      user?.id,
      primaryOutcomeReason,
      executedTradeId,
    ],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trade_analyses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("primary_outcome_reason", primaryOutcomeReason!)
        .neq("executed_trade_id", executedTradeId!)
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
    enabled:
      !!user &&
      !!executedTradeId &&
      !!primaryOutcomeReason &&
      // Skip the obvious non-mistakes — there's no learning value in
      // "you've won before" or "still open" badges.
      !["won_per_plan", "trade_not_yet_closed", "manual_no_signal"].includes(
        primaryOutcomeReason,
      ),
  });

  return query.data ?? 0;
}
