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
import { useTradingAccounts, useRiskProfile } from "@/hooks/use-account";
import { useCreateExecutedTrade } from "@/hooks/use-executed-trades";
import { usePipValue } from "@/hooks/use-pip-value";
import { evaluateTrade } from "@/lib/risk-engine";
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
  }, [open, signal, defaultAccount?.id]);

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
        conservativeMode: riskProfile?.conservative_mode ?? false,
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
    riskProfile?.conservative_mode,
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

  const isManual = !signal;
  const canSubmit =
    !!form.account_id &&
    !!form.symbol &&
    !!form.actual_entry_price &&
    !createMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedAccount) return;

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
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional — execution context, slippage, emotion"
                className="min-h-[60px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit}
            >
              {createMutation.isPending ? "Opening trade..." : "Open Trade"}
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
