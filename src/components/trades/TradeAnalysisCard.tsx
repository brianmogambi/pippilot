import { Activity, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { TradeAnalysisRow } from "@/types/trading";
import {
  summarizeAnalysis,
  type PrimaryOutcomeReason,
  type TradeAnalysisFlag,
} from "@/lib/trade-analysis";

/**
 * Phase 18.5: read-only renderer for a trade_analyses row.
 *
 * Lives in src/components/trades/ rather than the journal folder
 * because it is consumed both from JournalDetailDrawer (linked
 * journal entries) and — in Phase 18.6 — from any standalone
 * executed-trade detail surface.
 *
 * Defensively renders nothing when the analysis is null so callers
 * can treat it as a fire-and-forget child without conditional JSX.
 */

const FLAG_LABELS: Record<string, { label: string; tone: "warn" | "bad" | "ok" }> = {
  late_entry: { label: "Late entry", tone: "warn" },
  early_entry: { label: "Early entry", tone: "warn" },
  tighter_stop_than_plan: { label: "Tighter stop than plan", tone: "warn" },
  wider_stop_than_plan: { label: "Wider stop than plan", tone: "bad" },
  reduced_rr: { label: "Reduced R:R", tone: "bad" },
  improved_rr: { label: "Improved R:R", tone: "ok" },
  followed_plan: { label: "Followed plan", tone: "ok" },
  deviated_from_plan: { label: "Deviated from plan", tone: "warn" },
  setup_failed_normally: { label: "Setup failed normally", tone: "warn" },
  signal_invalidated: { label: "Signal invalidated", tone: "warn" },
  probable_execution_error: { label: "Probable execution error", tone: "bad" },
};

const OUTCOME_LABEL: Record<string, string> = {
  won_per_plan: "Won — followed the plan",
  won_despite_execution_drift: "Won despite execution drift",
  lost_per_plan: "Lost — in-plan loss",
  lost_to_execution_drift: "Lost — execution drift",
  signal_invalidated: "Signal invalidated before resolution",
  breakeven: "Breakeven",
  manual_no_signal: "Manual trade (no signal)",
  trade_not_yet_closed: "Still open",
  cancelled: "Cancelled",
};

const TONE_CLASS: Record<"warn" | "bad" | "ok", string> = {
  ok: "border-bullish/30 bg-bullish/15 text-bullish",
  warn: "border-warning/40 bg-warning/15 text-warning",
  bad: "border-bearish/30 bg-bearish/15 text-bearish",
};

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <span>—</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted" />
      </div>
    );
  }
  const colorClass =
    value >= 75 ? "bg-bullish" : value >= 50 ? "bg-warning" : "bg-bearish";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground font-semibold">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface Props {
  analysis: TradeAnalysisRow | null | undefined;
  /** When true, skip the heading row — useful inside an existing card. */
  compact?: boolean;
}

export default function TradeAnalysisCard({ analysis, compact = false }: Props) {
  if (!analysis) return null;

  const outcomeLabel =
    OUTCOME_LABEL[analysis.primary_outcome_reason ?? ""] ?? "Analysis";
  const flags = analysis.flags ?? [];
  const actions = analysis.improvement_actions ?? [];

  // Phase 18.6: derive the natural-language review on the fly from
  // the persisted row. The summarizer is pure, fast, and always in
  // sync with the current rule version, so we never need to backfill
  // when the templates change.
  const review = summarizeAnalysis({
    flags: flags as TradeAnalysisFlag[],
    primaryOutcomeReason:
      (analysis.primary_outcome_reason as PrimaryOutcomeReason | null) ??
      "trade_not_yet_closed",
    signalQualityScore: analysis.signal_quality_score,
    executionQualityScore: analysis.execution_quality_score,
    improvementActions: actions,
  });

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
      {!compact && (
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Post-trade analysis
          </h4>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {analysis.primary_outcome_reason === "won_per_plan" ? (
          <CheckCircle2 className="h-4 w-4 text-bullish" />
        ) : analysis.primary_outcome_reason?.startsWith("lost") ? (
          <AlertTriangle className="h-4 w-4 text-bearish" />
        ) : (
          <Activity className="h-4 w-4 text-warning" />
        )}
        <span className="text-sm font-medium text-foreground">{outcomeLabel}</span>
      </div>

      {/* Phase 18.6: NL post-trade review */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground leading-snug">
          {review.headline}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {review.body}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <ScoreBar label="Signal" value={analysis.signal_quality_score} />
        <ScoreBar label="Execution" value={analysis.execution_quality_score} />
        <ScoreBar label="Discipline" value={analysis.discipline_score} />
        <ScoreBar label="Risk mgmt" value={analysis.risk_management_score} />
      </div>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f) => {
            const meta = FLAG_LABELS[f] ?? { label: f, tone: "warn" as const };
            return (
              <span
                key={f}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONE_CLASS[meta.tone]}`}
              >
                {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {actions.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-primary/10">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            What to do differently
          </div>
          <ul className="space-y-1 text-xs text-foreground">
            {actions.slice(0, 4).map((a, i) => (
              <li key={i} className="leading-snug">• {a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
