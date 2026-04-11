import type { PairAnalysis, PairAnalysisRow } from "@/types/trading";

/**
 * Map a `pair_analyses` DB row to the domain `PairAnalysis` type.
 *
 * The Phase 8 explanation metadata columns are read via narrow casts so
 * `src/integrations/supabase/types.ts` doesn't have to be regenerated
 * for every additive migration.
 *
 * Shared between `use-signals.ts` and `use-market-data.ts` so both
 * call sites stay in lockstep on the metadata mapping.
 */
export function rowToAnalysis(row: PairAnalysisRow): PairAnalysis {
  const meta = row as PairAnalysisRow & {
    explanation_source?: string | null;
    explanation_status?: string | null;
    explanation_model?: string | null;
    explanation_prompt_version?: string | null;
    explanation_generated_at?: string | null;
    explanation_error_code?: string | null;
  };
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
    explanationSource:
      (meta.explanation_source as PairAnalysis["explanationSource"]) ?? null,
    explanationStatus:
      (meta.explanation_status as PairAnalysis["explanationStatus"]) ?? null,
    explanationModel: meta.explanation_model ?? null,
    explanationPromptVersion: meta.explanation_prompt_version ?? null,
    explanationGeneratedAt: meta.explanation_generated_at ?? null,
    explanationErrorCode: meta.explanation_error_code ?? null,
  };
}
