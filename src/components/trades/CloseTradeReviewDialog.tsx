import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Link2,
  Star,
} from "lucide-react";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import StatusBadge from "@/components/ui/status-badge";
import { useCloseExecutedTrade } from "@/hooks/use-executed-trades";
import { useCreateJournalEntry } from "@/hooks/use-journal";
import { useTradingAccount } from "@/hooks/use-account";
import { usePipValues } from "@/hooks/use-pip-value";
import {
  useUpsertTradeAnalysis,
  tradeAnalysisOutputToInsert,
} from "@/hooks/use-trade-analyses";
import { computeTradePnl } from "@/lib/trade-pnl";
import { analyzeTrade } from "@/lib/trade-analysis";
import type { AccountMode, ExecutedTrade } from "@/types/trading";

/**
 * Phase 18.4: unified "close & review" dialog.
 *
 * One submit does two things:
 *   1. Patches the executed_trades row with exit price, closed_at,
 *      result_status, pnl, pnl_percent, and optional notes.
 *   2. Optionally inserts a trade_journal_entries row, auto-prefilled
 *      from the executed_trades snapshot and the user's review inputs,
 *      linked via executed_trade_id.
 *
 * Structured review fields (ratings, emotions, mistake tags) are laid
 * out underneath the close form and collapsible when the user just
 * wants to close fast. Screenshot URLs are plain text inputs for now
 * — a file upload flow is Phase 18.8 polish.
 */

const MISTAKE_TAG_OPTIONS = [
  { value: "late_entry", label: "Entered too late" },
  { value: "early_entry", label: "Entered too early" },
  { value: "moved_stop_loss", label: "Moved stop loss" },
  { value: "moved_take_profit", label: "Moved take profit" },
  { value: "oversized", label: "Oversized position" },
  { value: "fomo_entry", label: "FOMO entry" },
  { value: "revenge_trade", label: "Revenge trade" },
  { value: "ignored_plan", label: "Ignored plan" },
  { value: "ignored_risk_rules", label: "Ignored risk rules" },
] as const;

interface CloseTradeReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ExecutedTrade | null;
  onSuccess?: () => void;
}

type FormState = {
  exit_price: string;
  create_journal: boolean;
  expand_review: boolean;
  lesson_learned: string;
  emotion_before: string;
  emotion_after: string;
  setup_rating: number;
  execution_rating: number;
  discipline_rating: number;
  followed_plan: boolean;
  mistake_tags: string[];
  screenshot_before: string;
  screenshot_after: string;
  close_notes: string;
};

const emptyForm: FormState = {
  exit_price: "",
  create_journal: true,
  expand_review: false,
  lesson_learned: "",
  emotion_before: "",
  emotion_after: "",
  setup_rating: 0,
  execution_rating: 0,
  discipline_rating: 0,
  followed_plan: true,
  mistake_tags: [],
  screenshot_before: "",
  screenshot_after: "",
  close_notes: "",
};

export default function CloseTradeReviewDialog({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: CloseTradeReviewDialogProps) {
  const closeMutation = useCloseExecutedTrade();
  const createJournal = useCreateJournalEntry();
  const upsertAnalysis = useUpsertTradeAnalysis();
  const { data: account } = useTradingAccount();
  const { getPipValue } = usePipValues();

  const [form, setForm] = useState<FormState>(emptyForm);

  // Reset form every time the dialog opens for a new trade so residue
  // from a previous trade never leaks into the next close.
  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
  }, [open, trade?.id]);

  // Live P&L preview as the user types the exit price. Intentionally
  // derived from form state + trade props — no mutation, no effects.
  const pnlPreview = useMemo(() => {
    if (!trade) return null;
    const exit = Number(form.exit_price);
    if (!form.exit_price || Number.isNaN(exit)) return null;
    const entry = Number(trade.actual_entry_price);
    if (!entry) return null;
    const pipValue = getPipValue(trade.symbol);
    return computeTradePnl({
      direction: trade.direction as "long" | "short",
      pair: trade.symbol,
      entryPrice: entry,
      exitPrice: exit,
      lotSize: trade.lot_size != null ? Number(trade.lot_size) : null,
      pipValueUsdPerLot: pipValue,
      accountBalance:
        account && account.id === trade.account_id
          ? Number(account.balance)
          : null,
    });
  }, [form.exit_price, trade, account, getPipValue]);

  const isSubmitting = closeMutation.isPending || createJournal.isPending;
  const canSubmit = !!trade && !!form.exit_price && !isSubmitting;

  if (!trade) return null;

  const toggleMistake = (tag: string) =>
    setForm((f) => ({
      ...f,
      mistake_tags: f.mistake_tags.includes(tag)
        ? f.mistake_tags.filter((t) => t !== tag)
        : [...f.mistake_tags, tag],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !pnlPreview) return;

    const closedAt = new Date().toISOString();

    // 1. Close the executed trade.
    await closeMutation.mutateAsync({
      id: trade.id,
      payload: {
        actual_exit_price: Number(form.exit_price),
        closed_at: closedAt,
        result_status: pnlPreview.resultStatus,
        pnl: pnlPreview.pnlUsd,
        pnl_percent: pnlPreview.pnlPercent != null ? pnlPreview.pnlPercent * 100 : null,
        notes: form.close_notes || trade.notes || null,
      },
    });

    // 2. Phase 18.5: run the rule engine and persist the analysis.
    // We intentionally compute this BEFORE the optional journal insert
    // so the resulting flags can also flow into Phase 18.6's NL review.
    // Failures are soft — the trade is already closed and the analysis
    // can always be recomputed later from the same persisted inputs.
    try {
      const analysis = analyzeTrade({
        direction: trade.direction as "long" | "short",
        pair: trade.symbol,
        plannedEntryLow:
          trade.planned_entry_low != null ? Number(trade.planned_entry_low) : null,
        plannedEntryHigh:
          trade.planned_entry_high != null ? Number(trade.planned_entry_high) : null,
        plannedStopLoss:
          trade.planned_stop_loss != null ? Number(trade.planned_stop_loss) : null,
        plannedTakeProfit1:
          trade.planned_take_profit_1 != null
            ? Number(trade.planned_take_profit_1)
            : null,
        plannedConfidence: trade.planned_confidence ?? null,
        actualEntry: Number(trade.actual_entry_price),
        actualStopLoss:
          trade.actual_stop_loss != null ? Number(trade.actual_stop_loss) : null,
        actualTakeProfit:
          trade.actual_take_profit != null ? Number(trade.actual_take_profit) : null,
        actualExit: Number(form.exit_price),
        resultStatus: pnlPreview.resultStatus,
        followedPlan: form.create_journal ? form.followed_plan : null,
        mistakeTags: form.create_journal ? form.mistake_tags : [],
        signalLinked: !!trade.signal_id,
        // Live signal status is fetched server-side in a future
        // background recompute job; the dialog only knows what the
        // trader knows at close time.
        liveSignalStatus: null,
      });
      await upsertAnalysis.mutateAsync(
        tradeAnalysisOutputToInsert(trade.id, analysis),
      );
    } catch (e) {
      // Soft failure — the toast is already raised by the hook's onError.
      console.error("Trade analysis failed", e);
    }

    // 3. Optionally create the linked journal entry.
    if (form.create_journal) {
      const journalPayload = {
        executed_trade_id: trade.id,
        account_mode: trade.account_mode as AccountMode,
        pair: trade.symbol,
        direction: trade.direction,
        entry_price: Number(trade.actual_entry_price),
        exit_price: Number(form.exit_price),
        stop_loss: trade.actual_stop_loss != null ? Number(trade.actual_stop_loss) : null,
        take_profit:
          trade.actual_take_profit != null ? Number(trade.actual_take_profit) : null,
        lot_size: trade.lot_size != null ? Number(trade.lot_size) : null,
        result_pips: Math.round(pnlPreview.pips * 10) / 10,
        result_amount:
          pnlPreview.pnlUsd != null ? Math.round(pnlPreview.pnlUsd * 100) / 100 : null,
        status: "closed",
        opened_at: trade.opened_at,
        closed_at: closedAt,
        setup_type: trade.planned_setup_type ?? null,
        confidence: trade.planned_confidence ?? null,
        setup_reasoning: trade.planned_reasoning_snapshot ?? null,
        followed_plan: form.followed_plan,
        lesson_learned: form.lesson_learned || null,
        emotion_before: form.emotion_before || null,
        emotion_after: form.emotion_after || null,
        setup_rating: form.setup_rating || null,
        execution_rating: form.execution_rating || null,
        discipline_rating: form.discipline_rating || null,
        mistake_tags: form.mistake_tags,
        screenshot_before: form.screenshot_before || null,
        screenshot_after: form.screenshot_after || null,
        notes: form.close_notes || null,
      };
      await createJournal.mutateAsync(journalPayload);
    }

    onOpenChange(false);
    onSuccess?.();
  };

  const directionIcon =
    trade.direction === "long" ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : (
      <ArrowDownRight className="h-3.5 w-3.5" />
    );
  const isLinked = !!trade.signal_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Close {trade.symbol}
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                trade.direction === "long" ? "text-bullish" : "text-bearish"
              }`}
            >
              {directionIcon}
              {trade.direction}
            </span>
            <AccountModeBadge mode={trade.account_mode as AccountMode} size="md" />
            {isLinked && (
              <StatusBadge variant="active" className="gap-1">
                <Link2 className="h-2.5 w-2.5" /> AI
              </StatusBadge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            PipPilot will patch the trade with the exit price and
            {form.create_journal
              ? " create a linked journal entry pre-filled from the snapshot."
              : " skip the journal entry."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Planned vs actual recap — compact so the dialog stays short */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Planned
              </p>
              <div className="space-y-0.5 text-xs font-mono">
                <RecapRow
                  label="Entry"
                  value={
                    trade.planned_entry_low != null && trade.planned_entry_high != null
                      ? trade.planned_entry_low === trade.planned_entry_high
                        ? String(trade.planned_entry_low)
                        : `${trade.planned_entry_low}–${trade.planned_entry_high}`
                      : "—"
                  }
                />
                <RecapRow label="SL" value={trade.planned_stop_loss ?? "—"} />
                <RecapRow label="TP" value={trade.planned_take_profit_1 ?? "—"} />
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                Actual
              </p>
              <div className="space-y-0.5 text-xs font-mono">
                <RecapRow label="Entry" value={trade.actual_entry_price} />
                <RecapRow label="SL" value={trade.actual_stop_loss ?? "—"} />
                <RecapRow label="TP" value={trade.actual_take_profit ?? "—"} />
              </div>
            </div>
          </div>

          {/* Exit price + live P&L preview */}
          <div className="space-y-1.5">
            <Label className="text-xs">Exit Price *</Label>
            <Input
              type="number"
              step="any"
              required
              autoFocus
              value={form.exit_price}
              onChange={(e) => setForm({ ...form, exit_price: e.target.value })}
            />
            {pnlPreview && (
              <div
                className={`rounded-md border p-3 flex items-center justify-between text-sm font-mono ${
                  pnlPreview.resultStatus === "win"
                    ? "border-bullish/30 bg-bullish/10"
                    : pnlPreview.resultStatus === "loss"
                    ? "border-bearish/30 bg-bearish/10"
                    : "border-border bg-muted/30"
                }`}
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {pnlPreview.resultStatus}
                </span>
                <div className="flex items-baseline gap-3">
                  <span
                    className={
                      pnlPreview.pips >= 0 ? "text-bullish font-semibold" : "text-bearish font-semibold"
                    }
                  >
                    {pnlPreview.pips >= 0 ? "+" : ""}
                    {pnlPreview.pips.toFixed(1)} pips
                  </span>
                  {pnlPreview.pnlUsd != null && (
                    <span
                      className={
                        pnlPreview.pnlUsd >= 0
                          ? "text-bullish"
                          : "text-bearish"
                      }
                    >
                      {pnlPreview.pnlUsd >= 0 ? "+" : ""}$
                      {Math.abs(pnlPreview.pnlUsd).toFixed(2)}
                    </span>
                  )}
                  {pnlPreview.pnlPercent != null && (
                    <span className="text-xs text-muted-foreground">
                      ({(pnlPreview.pnlPercent * 100).toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Journal toggle */}
          <label className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-foreground">
                Create linked journal entry
              </p>
              <p className="text-[11px] text-muted-foreground">
                Auto-prefilled from the planned snapshot. Uncheck to close without journaling.
              </p>
            </div>
            <Checkbox
              checked={form.create_journal}
              onCheckedChange={(c) => setForm({ ...form, create_journal: !!c })}
            />
          </label>

          {/* Review section (collapsible) */}
          {form.create_journal && (
            <>
              <button
                type="button"
                className="w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() =>
                  setForm((f) => ({ ...f, expand_review: !f.expand_review }))
                }
              >
                {form.expand_review ? "− Hide review fields" : "+ Add ratings, emotions, mistakes"}
              </button>

              {form.expand_review && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  {/* Ratings */}
                  <div className="grid grid-cols-3 gap-3">
                    <RatingField
                      label="Setup"
                      value={form.setup_rating}
                      onChange={(v) => setForm({ ...form, setup_rating: v })}
                    />
                    <RatingField
                      label="Execution"
                      value={form.execution_rating}
                      onChange={(v) => setForm({ ...form, execution_rating: v })}
                    />
                    <RatingField
                      label="Discipline"
                      value={form.discipline_rating}
                      onChange={(v) => setForm({ ...form, discipline_rating: v })}
                    />
                  </div>

                  {/* Followed plan */}
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="followed_plan_close"
                      checked={form.followed_plan}
                      onCheckedChange={(c) =>
                        setForm({ ...form, followed_plan: !!c })
                      }
                    />
                    <Label htmlFor="followed_plan_close" className="flex items-center gap-1.5">
                      {form.followed_plan ? (
                        <CheckCircle2 className="h-4 w-4 text-bullish" />
                      ) : (
                        <XCircle className="h-4 w-4 text-bearish" />
                      )}
                      Followed trading plan
                    </Label>
                  </div>

                  {/* Mistake tags */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mistake tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {MISTAKE_TAG_OPTIONS.map((m) => {
                        const on = form.mistake_tags.includes(m.value);
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => toggleMistake(m.value)}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              on
                                ? "border-bearish/50 bg-bearish/15 text-bearish"
                                : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40"
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Emotions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emotion before</Label>
                      <Input
                        value={form.emotion_before}
                        onChange={(e) =>
                          setForm({ ...form, emotion_before: e.target.value })
                        }
                        placeholder="e.g. confident, anxious"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emotion after</Label>
                      <Input
                        value={form.emotion_after}
                        onChange={(e) =>
                          setForm({ ...form, emotion_after: e.target.value })
                        }
                        placeholder="e.g. relieved, frustrated"
                      />
                    </div>
                  </div>

                  {/* Lesson learned */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lesson learned</Label>
                    <Textarea
                      value={form.lesson_learned}
                      onChange={(e) =>
                        setForm({ ...form, lesson_learned: e.target.value })
                      }
                      className="min-h-[60px]"
                      placeholder="What would you do differently next time?"
                    />
                  </div>

                  {/* Screenshots */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Screenshot before (URL)</Label>
                      <Input
                        value={form.screenshot_before}
                        onChange={(e) =>
                          setForm({ ...form, screenshot_before: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Screenshot after (URL)</Label>
                      <Input
                        value={form.screenshot_after}
                        onChange={(e) =>
                          setForm({ ...form, screenshot_after: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Free-form close note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Close notes</Label>
            <Textarea
              value={form.close_notes}
              onChange={(e) => setForm({ ...form, close_notes: e.target.value })}
              placeholder="Optional — why you closed now, slippage, context"
              className="min-h-[50px]"
            />
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {isSubmitting
              ? "Closing..."
              : form.create_journal
              ? "Close & Journal"
              : "Close Trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecapRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-sans">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            aria-label={`Rate ${label} ${n}/5`}
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                n <= value
                  ? "text-warning fill-warning"
                  : "text-muted-foreground/30 hover:text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
