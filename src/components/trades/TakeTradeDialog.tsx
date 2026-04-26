import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Wallet,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useTradingAccounts, useRiskProfile } from "@/hooks/use-account";
import { useCreateExecutedTrade } from "@/hooks/use-executed-trades";
import { usePipValue } from "@/hooks/use-pip-value";
import { useDailyRiskUsed } from "@/hooks/use-daily-risk";
import {
  evaluateTrade,
  calculateMoneyAtRiskUSD,
  calculatePipDistance,
} from "@/lib/risk-engine";
import {
  buildExecutedTradeFromSignal,
  buildManualExecutedTrade,
} from "@/lib/trade-build/build-executed-trade";
import type {
  AccountMode,
  EnrichedSignal,
  Signal,
  TradingAccount,
} from "@/types/trading";

/**
 * Phase 18.3: the canonical "open an executed trade" dialog.
 *
 * Two entry modes:
 *  - Signal-linked: pass a `signal` (Signal or EnrichedSignal). The
 *    dialog snapshots every planned_* field at render time and locks
 *    symbol + direction — those come from the signal, not the user.
 *  - Manual: omit `signal`. The user picks symbol and direction
 *    themselves, the planned_* snapshot is null, and signal_id is
 *    null (`source = manual` in journal filters).
 *
 * The user ALWAYS picks the account and can edit actual_* fields
 * even when signal-linked, because the whole point of Phase 5+
 * analytics is comparing what the signal said to what the user
 * actually did.
 */

interface TakeTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Signal to link. Pass null/undefined for a manual trade. */
  signal?: EnrichedSignal | Signal | null;
  /** Optional trigger button rendered inside <DialogTrigger>. */
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type FormState = {
  account_id: string;
  symbol: string;
  direction: "long" | "short";
  actual_entry_price: string;
  actual_stop_loss: string;
  actual_take_profit: string;
  lot_size: string;
  notes: string;
};

const emptyForm: FormState = {
  account_id: "",
  symbol: "",
  direction: "long",
  actual_entry_price: "",
  actual_stop_loss: "",
  actual_take_profit: "",
  lot_size: "",
  notes: "",
};

// Phase 18.9: planned-zone resolution moved into the pure helper
// at src/lib/trade-build/build-executed-trade.ts so the dialog and
// tests share exactly the same snapshot logic.

export default function TakeTradeDialog({
  open,
  onOpenChange,
  signal,
  trigger,
  onSuccess,
}: TakeTradeDialogProps) {
  const { data: accounts = [] } = useTradingAccounts();
  const { data: riskProfile } = useRiskProfile();
  const createMutation = useCreateExecutedTrade();

  const [form, setForm] = useState<FormState>(emptyForm);
  // Phase 2 (improvement plan): conservative-mode override scoped to
  // the dialog session so a beginner can halve the suggestion without
  // changing their saved profile. Re-seeds from the profile each time
  // the dialog opens.
  const [conservativeOverride, setConservativeOverride] = useState(false);
  // Phase 7 (improvement plan): one-time-per-session acknowledgment
  // that the analysis isn't financial advice. Stored on sessionStorage
  // so the user only sees the friction once per browsing session, not
  // on every trade. The flag drives both the local state seed and the
  // post-submit persist.
  const [acknowledged, setAcknowledged] = useState(() => {
    if (typeof sessionStorage === "undefined") return true;
    return sessionStorage.getItem("pippilot.takeTrade.acknowledged") === "1";
  });

  // Phase 18.10: live pip value for the pair the user is opening in.
  // Falls back to a static estimate when market data isn't loaded yet
  // — the suggestion still renders but is labelled "(estimated)".
  const { pipValue: pipValueUsd, freshness: pipFreshness } = usePipValue(
    form.symbol || "EUR/USD",
  );

  // Preferred default: the user's default account. Re-runs whenever the
  // account list arrives asynchronously.
  const defaultAccount: TradingAccount | undefined = useMemo(
    () => accounts.find((a) => a.is_default) ?? accounts[0],
    [accounts],
  );

  // Re-seed the form every time the dialog opens or the signal changes.
  // We intentionally DO NOT depend on `form` here — editing a field must
  // not trigger a snapshot re-seed mid-typing.
  useEffect(() => {
    if (!open) return;
    const isLong =
      signal && (signal.direction === "long" || signal.direction === "buy");
    setForm({
      account_id: defaultAccount?.id ?? "",
      symbol: signal?.pair ?? "",
      direction: signal ? (isLong ? "long" : "short") : "long",
      actual_entry_price: signal?.entry_price != null ? String(signal.entry_price) : "",
      actual_stop_loss: signal?.stop_loss != null ? String(signal.stop_loss) : "",
      actual_take_profit:
        signal?.take_profit_1 != null ? String(signal.take_profit_1) : "",
      lot_size: "",
      notes: "",
    });
    setConservativeOverride(riskProfile?.conservative_mode ?? false);
  }, [open, signal, defaultAccount?.id, riskProfile?.conservative_mode]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === form.account_id),
    [accounts, form.account_id],
  );
  const selectedMode: AccountMode =
    (selectedAccount?.account_mode as AccountMode | undefined) ?? "demo";

  // Phase 18.10: live risk-sized lot suggestion. Uses the existing
  // `evaluateTrade()` engine — the same one that powers the /calculator
  // page — so the dialog and the standalone calculator always agree.
  // Re-runs whenever the user edits the entry, SL, symbol, or swaps
  // accounts, but NOT when they type into the lot_size input (so the
  // suggestion stays stable while the user decides whether to accept
  // or override it).
  const riskTargetPct = Number(riskProfile?.risk_per_trade_pct ?? 1);
  const suggestion = useMemo(() => {
    if (!selectedAccount) return null;
    const entry = Number(form.actual_entry_price);
    const sl = Number(form.actual_stop_loss);
    if (!entry || !sl || entry === sl || !form.symbol) return null;

    const evaluation = evaluateTrade({
      account: {
        balance: Number(selectedAccount.balance),
        equity: Number(selectedAccount.equity),
        currency: selectedAccount.account_currency,
      },
      profile: {
        riskPerTradePct: riskTargetPct,
        maxDailyLossPct: Number(riskProfile?.max_daily_loss_pct ?? 5),
        maxTotalOpenRiskPct: Number(riskProfile?.max_total_open_risk_pct ?? 10),
        conservativeMode: conservativeOverride,
      },
      trade: {
        pair: form.symbol,
        entry,
        stopLoss: sl,
        pipValueUSD: pipValueUsd,
        riskMode: "percent",
      },
      daily: { realizedLossUSD: 0, openRiskUSD: 0 },
    });

    if (evaluation.lotSize <= 0) return null;
    if (Object.keys(evaluation.validationErrors).length > 0) return null;

    return {
      lotSize: Math.round(evaluation.lotSize * 100) / 100,
      riskUsd: evaluation.riskAmountUSD,
      pipDistance: evaluation.pipDistance,
    };
  }, [
    selectedAccount,
    form.actual_entry_price,
    form.actual_stop_loss,
    form.symbol,
    pipValueUsd,
    riskTargetPct,
    riskProfile?.max_daily_loss_pct,
    riskProfile?.max_total_open_risk_pct,
    conservativeOverride,
  ]);

  // Over-limit warning: fires when the user's typed lot size exceeds
  // the risk-engine suggestion by >50%. We compute the implied risk %
  // so the warning is specific ("1.6% of account") rather than vague.
  const overLimit = useMemo(() => {
    if (!suggestion) return null;
    const typed = Number(form.lot_size);
    if (!typed || typed <= suggestion.lotSize * 1.5) return null;
    const ratio = typed / suggestion.lotSize;
    return {
      typed,
      ratio,
      impliedRiskPct: ratio * riskTargetPct,
    };
  }, [suggestion, form.lot_size, riskTargetPct]);

  // Phase 2 (improvement plan): scope the daily-risk gauge to the
  // selected account (not the user's default) so the preview reflects
  // the real exposure for THIS trade's account.
  const selectedBalance = Number(selectedAccount?.balance ?? 0);
  const dailyRisk = useDailyRiskUsed({
    accountMode: selectedMode,
    balance: selectedBalance || undefined,
  });
  const maxDailyLossPct = Number(riskProfile?.max_daily_loss_pct ?? 5);

  // Live risk preview: dollar loss if SL is hit, computed from the
  // user's TYPED lot size (or the suggestion if they haven't typed
  // one yet). This is the figure a beginner needs to internalise
  // BEFORE submitting — abstract percentages aren't enough.
  const livePreview = useMemo(() => {
    if (!selectedAccount || !form.symbol) return null;
    const entry = Number(form.actual_entry_price);
    const sl = Number(form.actual_stop_loss);
    if (!entry || !sl || entry === sl) return null;

    const typedLot = Number(form.lot_size);
    const effectiveLot =
      typedLot > 0 ? typedLot : suggestion?.lotSize ?? 0;
    if (effectiveLot <= 0) return null;

    const pipDistance = calculatePipDistance(form.symbol, entry, sl);
    const riskUsd = calculateMoneyAtRiskUSD(
      effectiveLot,
      pipDistance,
      pipValueUsd,
    );
    const balance = selectedBalance || 1; // avoid divide-by-zero
    const tradeRiskPct = (riskUsd / balance) * 100;
    const projectedDailyPct = dailyRisk.riskUsedPct + tradeRiskPct;
    const wouldExceedDailyCap = projectedDailyPct > maxDailyLossPct;

    return {
      lotSize: effectiveLot,
      lotSource: typedLot > 0 ? ("typed" as const) : ("suggested" as const),
      riskUsd,
      tradeRiskPct,
      projectedDailyPct,
      remainingPct: Math.max(0, maxDailyLossPct - dailyRisk.riskUsedPct),
      wouldExceedDailyCap,
    };
  }, [
    selectedAccount,
    selectedBalance,
    form.symbol,
    form.actual_entry_price,
    form.actual_stop_loss,
    form.lot_size,
    pipValueUsd,
    suggestion?.lotSize,
    dailyRisk.riskUsedPct,
    maxDailyLossPct,
  ]);

  const isManual = !signal;
  const canSubmit =
    !!form.account_id &&
    !!form.symbol &&
    !!form.actual_entry_price &&
    !createMutation.isPending &&
    !(livePreview?.wouldExceedDailyCap ?? false) &&
    acknowledged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedAccount) return;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("pippilot.takeTrade.acknowledged", "1");
    }

    // Phase 18.9: payload construction lives in the pure helper so
    // the "signal snapshot correctness" contract can be unit-tested
    // independently of React. See build-executed-trade.test.ts.
    const formInputs = {
      symbol: form.symbol,
      direction: form.direction,
      actualEntryPrice: Number(form.actual_entry_price),
      actualStopLoss: form.actual_stop_loss ? Number(form.actual_stop_loss) : null,
      actualTakeProfit: form.actual_take_profit
        ? Number(form.actual_take_profit)
        : null,
      lotSize: form.lot_size ? Number(form.lot_size) : null,
      notes: form.notes || null,
    };
    const accountRef = {
      id: selectedAccount.id,
      account_mode: selectedMode,
    };
    const payload = signal
      ? buildExecutedTradeFromSignal(signal, formInputs, accountRef)
      : buildManualExecutedTrade(formInputs, accountRef);

    await createMutation.mutateAsync(payload);

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {signal ? (
              <>
                <Zap className="h-4 w-4 text-primary" />
                Take Trade — {signal.pair}
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4 text-primary" />
                New Manual Trade
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {signal
              ? "PipPilot will snapshot the signal as-is so the post-trade review can compare your execution to the plan."
              : "Log a discretionary trade with no AI signal. You can link it to a signal later if needed."}
          </DialogDescription>
        </DialogHeader>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
            <p className="text-warning font-medium mb-1">No trading account found</p>
            <p className="text-muted-foreground text-xs">
              Create one in{" "}
              <Link to="/settings" className="text-primary underline">
                Settings
              </Link>{" "}
              first. Every executed trade has to be tied to an account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account + Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs">Account</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name}
                        {a.is_default ? " · default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AccountModeBadge mode={selectedMode} size="md" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Mode comes from the account and is snapshotted onto this trade.
              </p>
            </div>

            {/* Symbol + Direction */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Symbol</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  disabled={!isManual}
                  placeholder="EUR/USD"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Direction</Label>
                {isManual ? (
                  <Select
                    value={form.direction}
                    onValueChange={(v) =>
                      setForm({ ...form, direction: v as "long" | "short" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div
                    className={`flex items-center gap-1 rounded-md border border-border bg-muted/50 px-3 h-10 text-sm font-medium ${
                      form.direction === "long" ? "text-bullish" : "text-bearish"
                    }`}
                  >
                    {form.direction === "long" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {form.direction === "long" ? "Long" : "Short"}
                  </div>
                )}
              </div>
            </div>

            {/* Planned recap (only when signal-linked) */}
            {signal && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  Planned snapshot (from signal)
                </p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <PlannedCell label="Entry" value={signal.entry_price} />
                  <PlannedCell label="SL" value={signal.stop_loss} className="text-bearish" />
                  <PlannedCell
                    label="TP1"
                    value={signal.take_profit_1}
                    className="text-bullish"
                  />
                  <PlannedCell
                    label="Conf."
                    value={signal.confidence != null ? `${signal.confidence}%` : "—"}
                  />
                </div>
              </div>
            )}

            {/* Actuals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Actual Entry *</Label>
                <Input
                  type="number"
                  step="any"
                  required
                  value={form.actual_entry_price}
                  onChange={(e) =>
                    setForm({ ...form, actual_entry_price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Actual SL</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.actual_stop_loss}
                  onChange={(e) =>
                    setForm({ ...form, actual_stop_loss: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Actual TP</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.actual_take_profit}
                  onChange={(e) =>
                    setForm({ ...form, actual_take_profit: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Lot Size</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.lot_size}
                    onChange={(e) =>
                      setForm({ ...form, lot_size: e.target.value })
                    }
                    placeholder={
                      suggestion ? suggestion.lotSize.toFixed(2) : "e.g. 0.10"
                    }
                  />
                </div>
              </div>

              {/* Phase 18.10: risk-engine-driven suggestion + over-limit warning */}
              {suggestion ? (
                <div className="rounded-md border border-primary/20 bg-primary/[0.04] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-primary" />
                      <span>
                        Suggested:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {suggestion.lotSize.toFixed(2)} lots
                        </span>
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2"
                      onClick={() =>
                        setForm({
                          ...form,
                          lot_size: suggestion.lotSize.toFixed(2),
                        })
                      }
                    >
                      Use suggested
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {riskTargetPct}% of account ={" "}
                    <span className="font-mono text-foreground">
                      ${suggestion.riskUsd.toFixed(2)}
                    </span>{" "}
                    on a {suggestion.pipDistance.toFixed(1)}-pip stop
                    {pipFreshness !== "live" && (
                      <span className="ml-1 opacity-70">
                        (pip value estimated — no live market data)
                      </span>
                    )}
                  </p>
                  {overLimit && (
                    <div className="flex items-start gap-1.5 text-[10px] text-warning border-t border-warning/20 pt-1.5 mt-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="leading-snug">
                        {overLimit.typed.toFixed(2)} lots is ~
                        {overLimit.ratio.toFixed(1)}× your target — that's{" "}
                        <span className="font-semibold">
                          {overLimit.impliedRiskPct.toFixed(1)}%
                        </span>{" "}
                        of account at risk on this trade.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                form.actual_entry_price &&
                form.actual_stop_loss && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Enter a different stop loss than the entry to see the
                    risk-sized suggestion.
                  </p>
                )
              )}

              {/* Phase 2 (improvement plan): conservative-mode toggle.
                  Halves the suggestion in one click — recommended for
                  beginners while building consistency. */}
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="conservative-mode" className="text-[11px] font-medium cursor-pointer">
                    Conservative mode
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Halves the suggested lot — useful while building consistency.
                  </span>
                </div>
                <Switch
                  id="conservative-mode"
                  checked={conservativeOverride}
                  onCheckedChange={setConservativeOverride}
                />
              </div>
            </div>

            {/* Phase 2 (improvement plan): Risk preview. Translates the
                abstract "1% risk" into the actual dollar loss for the
                user's account, and shows whether they have daily-budget
                room left. Hard-blocks submit when over cap. */}
            {livePreview && (
              <div
                className={`rounded-lg border p-3 space-y-2 ${
                  livePreview.wouldExceedDailyCap
                    ? "border-bearish/40 bg-bearish/[0.06]"
                    : livePreview.tradeRiskPct > riskTargetPct * 1.5
                      ? "border-warning/30 bg-warning/[0.06]"
                      : "border-primary/20 bg-primary/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    Risk preview
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AccountModeBadge mode={selectedMode} size="sm" />
                    <span className="text-[10px] text-muted-foreground">
                      ${selectedBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Potential loss if SL hits
                    </p>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      ${livePreview.riskUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {livePreview.tradeRiskPct.toFixed(2)}% of account
                      {livePreview.lotSource === "suggested" && " (using suggestion)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Daily risk used today
                    </p>
                    <p
                      className={`font-mono text-sm font-semibold ${
                        livePreview.wouldExceedDailyCap ? "text-bearish" : "text-foreground"
                      }`}
                    >
                      {livePreview.projectedDailyPct.toFixed(2)}% / {maxDailyLossPct}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dailyRisk.riskUsedPct.toFixed(2)}% open · {livePreview.remainingPct.toFixed(2)}% remaining
                    </p>
                  </div>
                </div>

                {livePreview.wouldExceedDailyCap && (
                  <div className="flex items-start gap-1.5 text-[11px] text-bearish border-t border-bearish/20 pt-2 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="leading-snug">
                      <span className="font-semibold">Blocked:</span> this trade would push your daily risk to{" "}
                      {livePreview.projectedDailyPct.toFixed(1)}%, past your{" "}
                      {maxDailyLossPct}% profile cap. Reduce the lot size or wait until tomorrow.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional — execution context, slippage, emotion"
                className="min-h-[60px]"
              />
            </div>

            {/* Phase 7 (improvement plan): one-time-per-session
                acknowledgment that the analysis is educational, not
                advice. Hidden after the first acknowledgment so it
                doesn't friction every subsequent trade in the same
                session. */}
            {!acknowledged && (
              <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border bg-muted/30 p-2.5">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[11px] text-muted-foreground leading-snug">
                  I understand PipPilot AI provides educational analysis only — not financial advice — and that I am responsible for the trades I take.
                </span>
              </label>
            )}

            {/* Phase 2 (improvement plan): one-line risk reminder
                directly above the action so it's the last thing the
                user sees before committing. */}
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Trading carries significant risk. Past performance does not guarantee future results.
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit}
            >
              {createMutation.isPending
                ? "Opening trade..."
                : livePreview?.wouldExceedDailyCap
                  ? "Blocked — over daily risk cap"
                  : "Open Trade"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlannedCell({
  label,
  value,
  className,
}: {
  label: string;
  value: number | string | null | undefined;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-xs ${className ?? "text-foreground"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}
