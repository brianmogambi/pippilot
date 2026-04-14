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
