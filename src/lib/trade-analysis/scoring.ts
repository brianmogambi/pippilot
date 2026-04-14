// Phase 18.5: scoring derivation.
//
// Pure functions that turn the raised flags + input back into a
// small set of 0–100 scores. Each score is a specific lens on
// "how did this trade go?" and they are intentionally independent
// so a trader can look at one (e.g. execution_quality_score) to
// decide whether a loss was their fault without conflating it
// with the signal's own quality.

import type {
  PrimaryOutcomeReason,
  TradeAnalysisFlag,
  TradeAnalysisInput,
} from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Signal quality = how good the signal was independent of what the
 * user did. Starts from the signal's own planned confidence and is
 * adjusted by whether the setup played out when followed cleanly.
 * Returns null for manual trades (no signal to score).
 */
export function scoreSignalQuality(
  input: TradeAnalysisInput,
  flags: TradeAnalysisFlag[],
): number | null {
  if (!input.signalLinked) return null;
  let base = input.plannedConfidence ?? 50;

  const droveToSuccess =
    input.resultStatus === "win" && !flags.includes("deviated_from_plan");
  const failedOnOwnMerits = flags.includes("setup_failed_normally");
  const invalidated = flags.includes("signal_invalidated");

  if (droveToSuccess) base += 10;
  if (failedOnOwnMerits) base -= 15;
  if (invalidated) base -= 20;

  return clamp(base);
}

/**
 * Execution quality = how closely the user stuck to the plan
 * mechanically. Manual trades return null because there is no
 * plan to compare against.
 */
export function scoreExecutionQuality(
  input: TradeAnalysisInput,
  flags: TradeAnalysisFlag[],
): number | null {
  if (!input.signalLinked) return null;

  let score = 100;
  if (flags.includes("late_entry")) score -= 20;
  if (flags.includes("early_entry")) score -= 15;
  if (flags.includes("tighter_stop_than_plan")) score -= 20;
  if (flags.includes("wider_stop_than_plan")) score -= 15;
  // reduced_rr dominates improved_rr when both somehow fire (shouldn't)
  if (flags.includes("reduced_rr")) score -= 15;
  return clamp(score);
}

/**
 * Discipline = self-reported plan adherence + mistake tags.
 * Works for both linked and manual trades — it measures the
 * trader, not the signal.
 */
export function scoreDiscipline(input: TradeAnalysisInput): number {
  let score = 100;
  if (input.followedPlan === false) score -= 30;
  const tagCount = (input.mistakeTags ?? []).length;
  score -= Math.min(60, tagCount * 10);
  return clamp(score);
}

/**
 * Risk management = were the risk rules respected? Wider stops,
 * reduced R:R, and explicit oversizing/ignored-risk tags pull the
 * score down. A tighter stop does NOT boost risk management
 * because reducing invalidation room often means giving up a
 * valid setup, not risk discipline.
 */
export function scoreRiskManagement(
  input: TradeAnalysisInput,
  flags: TradeAnalysisFlag[],
): number {
  let score = 100;
  if (flags.includes("wider_stop_than_plan")) score -= 25;
  if (flags.includes("reduced_rr")) score -= 20;

  const tags = input.mistakeTags ?? [];
  if (tags.includes("oversized")) score -= 15;
  if (tags.includes("ignored_risk_rules")) score -= 20;
  return clamp(score);
}

/**
 * Single canonical classification of the trade outcome. Consumed
 * by both the Phase 18.5 UI card and the Phase 18.6 NL summarizer
 * so both always agree on what the trade was.
 */
export function classifyOutcome(
  input: TradeAnalysisInput,
  flags: TradeAnalysisFlag[],
): PrimaryOutcomeReason {
  if (input.resultStatus === "open") return "trade_not_yet_closed";
  if (input.resultStatus === "cancelled") return "cancelled";
  if (flags.includes("signal_invalidated")) return "signal_invalidated";
  if (input.resultStatus === "breakeven") return "breakeven";
  if (!input.signalLinked) return "manual_no_signal";

  const hasDrift =
    flags.includes("late_entry") ||
    flags.includes("early_entry") ||
    flags.includes("tighter_stop_than_plan") ||
    flags.includes("wider_stop_than_plan") ||
    flags.includes("reduced_rr") ||
    flags.includes("deviated_from_plan");

  if (input.resultStatus === "win") {
    return hasDrift ? "won_despite_execution_drift" : "won_per_plan";
  }

  // loss
  if (hasDrift || flags.includes("probable_execution_error")) {
    return "lost_to_execution_drift";
  }
  return "lost_per_plan";
}

/**
 * Derive a small, ordered list of human-readable improvement
 * actions from the raised flags + mistake tags. The order matters
 * — callers render the first 3–4 as a bullet list and the NL
 * summarizer in Phase 18.6 consumes them as input hints.
 */
export function deriveImprovementActions(
  input: TradeAnalysisInput,
  flags: TradeAnalysisFlag[],
): string[] {
  const actions: string[] = [];

  if (flags.includes("late_entry")) {
    actions.push(
      "Wait for price to pull back into the planned entry zone before entering — the late fill reduced your risk/reward.",
    );
  }
  if (flags.includes("early_entry")) {
    actions.push(
      "Let price reach the planned entry zone before committing — entering early increases the chance of stop hunts.",
    );
  }
  if (flags.includes("tighter_stop_than_plan")) {
    actions.push(
      "Stop was tighter than the signal's invalidation level. Give the setup room to breathe or skip it.",
    );
  }
  if (flags.includes("wider_stop_than_plan")) {
    actions.push(
      "Stop was wider than the plan. Recheck risk-per-trade before accepting extra invalidation room.",
    );
  }
  if (flags.includes("reduced_rr")) {
    actions.push(
      "Risk/reward was materially worse than the plan. Consider moving TP back toward the original target or not taking the trade.",
    );
  }
  if (flags.includes("signal_invalidated")) {
    actions.push(
      "The signal's invalidation condition hit before you could manage the trade — consider alerting on invalidation.",
    );
  }
  if (flags.includes("probable_execution_error")) {
    actions.push(
      "This loss appears driven by execution rather than the signal. Review what you'd change next time.",
    );
  }
  if (flags.includes("setup_failed_normally")) {
    actions.push(
      "The setup was followed cleanly and still lost — this is an in-plan loss, not a mistake. No change needed.",
    );
  }

  const tags = input.mistakeTags ?? [];
  if (tags.includes("oversized")) {
    actions.push("Position was oversized. Recompute lot size against your risk-per-trade rule.");
  }
  if (tags.includes("revenge_trade")) {
    actions.push(
      "You flagged this as a revenge trade. Lock in a cooling-off rule after losses before the next entry.",
    );
  }
  if (tags.includes("ignored_risk_rules")) {
    actions.push(
      "You flagged ignored risk rules. Revisit your risk checklist and commit to enforcing it before the next entry.",
    );
  }
  if (tags.includes("fomo_entry")) {
    actions.push(
      "You flagged this as FOMO. Build a pre-trade checklist that gates entries on setup criteria, not price velocity.",
    );
  }

  return actions;
}
