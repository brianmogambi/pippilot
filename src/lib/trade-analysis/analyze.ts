// Phase 18.5: top-level analyze() that runs every rule and
// composes the output. Pure — no Supabase, no network, no React.

import {
  checkDeviatedFromPlan,
  checkEarlyEntry,
  checkFollowedPlan,
  checkImprovedRR,
  checkLateEntry,
  checkProbableExecutionError,
  checkReducedRR,
  checkSetupFailedNormally,
  checkSignalInvalidated,
  checkTighterStop,
  checkWiderStop,
  type RuleHit,
} from "./rules";
import {
  classifyOutcome,
  deriveImprovementActions,
  scoreDiscipline,
  scoreExecutionQuality,
  scoreRiskManagement,
  scoreSignalQuality,
} from "./scoring";
import type {
  TradeAnalysisFlag,
  TradeAnalysisInput,
  TradeAnalysisOutput,
} from "./types";

export const TRADE_ANALYSIS_RULE_VERSION = "v1";

/**
 * Drift-class flags are the subset that represent *execution*
 * divergence from the plan. They are used by followed_plan,
 * deviated_from_plan, setup_failed_normally and probable_execution_error
 * to reason about "did the user stick to the plan?".
 */
const DRIFT_FLAGS: TradeAnalysisFlag[] = [
  "late_entry",
  "early_entry",
  "tighter_stop_than_plan",
  "wider_stop_than_plan",
  "reduced_rr",
];

function pushHit(
  hit: RuleHit | null,
  flags: TradeAnalysisFlag[],
  details: Record<string, unknown>,
): void {
  if (!hit) return;
  flags.push(hit.flag);
  details[hit.flag] = hit.detail;
}

export function analyzeTrade(input: TradeAnalysisInput): TradeAnalysisOutput {
  const flags: TradeAnalysisFlag[] = [];
  const details: Record<string, unknown> = {};

  // Open and cancelled trades skip the comparison rules entirely —
  // there is no exit price to reason about and classifyOutcome will
  // short-circuit to the right bucket below.
  if (input.resultStatus !== "open" && input.resultStatus !== "cancelled") {
    pushHit(checkLateEntry(input), flags, details);
    pushHit(checkEarlyEntry(input), flags, details);
    pushHit(checkTighterStop(input), flags, details);
    pushHit(checkWiderStop(input), flags, details);
    pushHit(checkReducedRR(input), flags, details);
    pushHit(checkImprovedRR(input), flags, details);
    pushHit(checkSignalInvalidated(input), flags, details);
  }

  const driftFlagsRaised = flags.filter((f) => DRIFT_FLAGS.includes(f));

  // Plan-adherence flags are derived from the drift flags above.
  pushHit(checkFollowedPlan(input, driftFlagsRaised), flags, details);
  pushHit(checkDeviatedFromPlan(input, driftFlagsRaised), flags, details);

  if (input.resultStatus !== "open" && input.resultStatus !== "cancelled") {
    pushHit(checkSetupFailedNormally(input, driftFlagsRaised), flags, details);
    pushHit(checkProbableExecutionError(input, driftFlagsRaised), flags, details);
  }

  const signalQualityScore = scoreSignalQuality(input, flags);
  const executionQualityScore = scoreExecutionQuality(input, flags);
  const disciplineScore = scoreDiscipline(input);
  const riskManagementScore = scoreRiskManagement(input, flags);
  const primaryOutcomeReason = classifyOutcome(input, flags);
  const improvementActions = deriveImprovementActions(input, flags);

  return {
    flags,
    details,
    signalQualityScore,
    executionQualityScore,
    disciplineScore,
    riskManagementScore,
    primaryOutcomeReason,
    improvementActions,
    ruleVersion: TRADE_ANALYSIS_RULE_VERSION,
  };
}
