// Phase 18.6: natural-language post-trade review.
//
// Pure template-based summarizer. Takes the rule-engine output and
// returns three fields the UI renders verbatim:
//   - headline:   one-line verdict ("Clean win — followed the plan.")
//   - body:       1-2 sentences explaining what happened and why
//   - nextAction: optional one-line forward-looking coaching, drawn
//                 from the persisted improvement_actions array
//
// Rules-first by design: no LLM call, no network, completely
// deterministic, easy to unit-test. The user can layer an LLM
// re-write on top later if they want richer prose, but the
// app must always have a correct fallback.
//
// Tone discipline:
//   * Hedge appropriately. We say "appears to", "likely", "suggests",
//     never "this caused the loss".
//   * Distinguish bad signal from bad execution from in-plan loss.
//   * Coach without scolding — in-plan losses get an explicit
//     "no execution change is needed" so the trader doesn't conclude
//     they did something wrong.
//   * Keep it short. Each body is one or two sentences.

import type {
  PrimaryOutcomeReason,
  TradeAnalysisFlag,
  TradeAnalysisOutput,
} from "./types";

export interface TradeReviewSummary {
  headline: string;
  body: string;
  nextAction: string | null;
}

/**
 * Subset of TradeAnalysisOutput the summarizer needs. Defining a
 * narrower input type means the UI can build it from either the
 * pure engine result or a persisted trade_analyses row without
 * the summarizer caring which.
 */
export interface SummarizeAnalysisInput {
  flags: TradeAnalysisFlag[];
  primaryOutcomeReason: PrimaryOutcomeReason;
  signalQualityScore: number | null;
  executionQualityScore: number | null;
  improvementActions: string[];
}

// ── Drift-phrase translation ────────────────────────────────────

const DRIFT_PHRASES: Partial<Record<TradeAnalysisFlag, string>> = {
  late_entry: "the executed entry was worse than the planned entry zone",
  early_entry: "you entered before price reached the planned zone",
  tighter_stop_than_plan: "the stop loss was tighter than the original invalidation",
  wider_stop_than_plan: "the stop loss was wider than the plan",
  reduced_rr: "the risk/reward was materially worse than planned",
  improved_rr: "the risk/reward was actually better than planned",
};

const DRIFT_FLAG_ORDER: TradeAnalysisFlag[] = [
  "late_entry",
  "early_entry",
  "tighter_stop_than_plan",
  "wider_stop_than_plan",
  "reduced_rr",
  "improved_rr",
];

function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

/**
 * Render the raised drift flags as a single English clause. Returns
 * an empty string when no drift was detected so callers can `if`-skip
 * cleanly without conditional template glue.
 */
export function describeDriftFlags(flags: TradeAnalysisFlag[]): string {
  const phrases = DRIFT_FLAG_ORDER.filter((f) => flags.includes(f))
    .map((f) => DRIFT_PHRASES[f])
    .filter((p): p is string => !!p);
  return joinClauses(phrases);
}

// ── Signal-quality framing ──────────────────────────────────────

/**
 * Hedged adjective for the signal's confidence band. Returns null
 * when there's no signal to talk about so callers can omit the
 * adjective entirely instead of saying "this medium-confidence trade"
 * about a manual position.
 */
export function describeSignalQuality(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 75) return "high-confidence";
  if (score >= 50) return "moderate-confidence";
  return "low-confidence";
}

// ── Body templates per outcome bucket ───────────────────────────

function bodyForOutcome(
  input: SummarizeAnalysisInput,
): string {
  const { primaryOutcomeReason: outcome, flags, signalQualityScore } = input;
  const drift = describeDriftFlags(flags);
  const confidenceTier = describeSignalQuality(signalQualityScore);
  const tierFragment = confidenceTier ? `${confidenceTier} ` : "";

  switch (outcome) {
    case "won_per_plan":
      return `You took this ${tierFragment}signal cleanly: entry, stop and target all matched the plan, and price reached your target. Keep replicating this approach.`;

    case "won_despite_execution_drift":
      return `Price ultimately reached your target, but ${drift || "the execution drifted from the plan"}. This worked out, but the drift reduced the setup quality and could easily have stopped you out instead.`;

    case "lost_per_plan":
      return `You followed this ${tierFragment}signal cleanly and the setup simply failed on its own merits. This appears to be a normal in-plan loss rather than an execution mistake — no change is needed unless the underlying pattern is no longer working.`;

    case "lost_to_execution_drift":
      if (drift) {
        return `The signal itself was reasonable, but ${drift}. That degraded the setup quality and likely contributed to the loss. Review the execution rather than the signal.`;
      }
      return `The signal itself was reasonable, but the execution drifted from the plan. That likely contributed to the loss — review the execution rather than the signal.`;

    case "signal_invalidated":
      return `The signal's invalidation condition triggered before this trade could resolve. Consider setting an alert on signal invalidation so similar trades can be managed earlier.`;

    case "breakeven":
      return `Trade closed at or near entry. No execution change is needed unless this becomes a recurring pattern.`;

    case "manual_no_signal":
      return `This was a discretionary trade with no AI signal to compare against, so no execution drift could be measured. The discipline and risk-management scores reflect your own self-reported review.`;

    case "trade_not_yet_closed":
      return `No exit price yet — the post-trade review will appear once you close this trade.`;

    case "cancelled":
      return `Trade was cancelled before it filled. No execution review applies.`;

    default:
      // Shouldn't happen — the outcome bucket is exhaustive — but
      // returning a hedge keeps the UI safe rather than throwing.
      return `No structured review available for this trade yet.`;
  }
}

// ── Headline templates per outcome bucket ───────────────────────

const HEADLINES: Record<PrimaryOutcomeReason, string> = {
  won_per_plan: "Clean win — followed the plan.",
  won_despite_execution_drift: "Won despite execution drift.",
  lost_per_plan: "In-plan loss — not an execution mistake.",
  lost_to_execution_drift: "Loss appears driven by execution, not the signal.",
  signal_invalidated: "Signal invalidated mid-trade.",
  breakeven: "Breakeven exit.",
  manual_no_signal: "Manual trade — discretionary review.",
  trade_not_yet_closed: "Trade still open.",
  cancelled: "Trade cancelled.",
};

// ── Public entry point ──────────────────────────────────────────

export function summarizeAnalysis(input: SummarizeAnalysisInput): TradeReviewSummary {
  const headline = HEADLINES[input.primaryOutcomeReason] ?? "Post-trade review";
  const body = bodyForOutcome(input);
  const nextAction =
    input.improvementActions.length > 0 ? input.improvementActions[0] : null;
  return { headline, body, nextAction };
}

/**
 * Convenience wrapper that takes a TradeAnalysisOutput (the engine's
 * own result type) so callers in the close flow don't have to cherry-
 * pick fields by hand.
 */
export function summarizeAnalysisOutput(
  output: TradeAnalysisOutput,
): TradeReviewSummary {
  return summarizeAnalysis({
    flags: output.flags,
    primaryOutcomeReason: output.primaryOutcomeReason,
    signalQualityScore: output.signalQualityScore,
    executionQualityScore: output.executionQualityScore,
    improvementActions: output.improvementActions,
  });
}
