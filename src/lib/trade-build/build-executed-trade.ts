// Phase 18.9: pure helper that builds an executed_trades insert
// payload from either a signal + actuals (the Take-Trade flow) or
// a manual entry (no signal).
//
// Extracted out of TakeTradeDialog so the "snapshot correctness"
// contract can be unit-tested independently of React. The exact
// planned_* fields copied here are the contract Phase 18.5's rule
// engine consumes — any regression in this function shows up as a
// wrong flag in analyzeTrade(), and the tests catch both.

import type {
  AccountMode,
  EnrichedSignal,
  Signal,
  TradingAccount,
} from "@/types/trading";
import type { ExecutedTradeInsert } from "@/hooks/use-executed-trades";

export interface TakeTradeFormInputs {
  symbol: string;
  direction: "long" | "short";
  actualEntryPrice: number;
  actualStopLoss: number | null;
  actualTakeProfit: number | null;
  lotSize: number | null;
  notes: string | null;
}

/**
 * Narrow the optional PairAnalysis.entryZone off an EnrichedSignal.
 * Signal (non-enriched) never has analysis; we fall back to the
 * point entry_price in that case.
 */
function resolvePlannedZone(
  signal: EnrichedSignal | Signal,
): { low: number; high: number } {
  if ("analysis" in signal && signal.analysis?.entryZone) {
    const [low, high] = signal.analysis.entryZone;
    return { low, high };
  }
  const point = Number(signal.entry_price);
  return { low: point, high: point };
}

/**
 * Build the insert payload for a signal-linked executed trade. The
 * planned_* fields are snapshotted at call time so later edits or
 * invalidation of the live signal never rewrite what the user
 * intended when they took the trade. Pure — no Supabase, no React.
 */
export function buildExecutedTradeFromSignal(
  signal: EnrichedSignal | Signal,
  form: TakeTradeFormInputs,
  account: Pick<TradingAccount, "id" | "account_mode">,
): ExecutedTradeInsert {
  const zone = resolvePlannedZone(signal);
  const mode = (account.account_mode as AccountMode) ?? "demo";
  return {
    account_id: account.id,
    account_mode: mode,
    signal_id: signal.id,
    symbol: form.symbol,
    direction: form.direction,
    planned_entry_low: zone.low,
    planned_entry_high: zone.high,
    planned_stop_loss: signal.stop_loss != null ? Number(signal.stop_loss) : null,
    planned_take_profit_1:
      signal.take_profit_1 != null ? Number(signal.take_profit_1) : null,
    planned_take_profit_2:
      signal.take_profit_2 != null ? Number(signal.take_profit_2) : null,
    planned_confidence: signal.confidence != null ? Number(signal.confidence) : null,
    planned_setup_type: signal.setup_type ?? null,
    planned_timeframe: signal.timeframe ?? null,
    planned_reasoning_snapshot: signal.ai_reasoning ?? null,
    actual_entry_price: form.actualEntryPrice,
    actual_stop_loss: form.actualStopLoss,
    actual_take_profit: form.actualTakeProfit,
    lot_size: form.lotSize,
    notes: form.notes,
    result_status: "open",
  };
}

/**
 * Manual-trade variant. `signal_id` is null, all planned_* fields
 * are null because there's no signal to snapshot.
 */
export function buildManualExecutedTrade(
  form: TakeTradeFormInputs,
  account: Pick<TradingAccount, "id" | "account_mode">,
): ExecutedTradeInsert {
  const mode = (account.account_mode as AccountMode) ?? "demo";
  return {
    account_id: account.id,
    account_mode: mode,
    signal_id: null,
    symbol: form.symbol,
    direction: form.direction,
    planned_entry_low: null,
    planned_entry_high: null,
    planned_stop_loss: null,
    planned_take_profit_1: null,
    planned_take_profit_2: null,
    planned_confidence: null,
    planned_setup_type: null,
    planned_timeframe: null,
    planned_reasoning_snapshot: null,
    actual_entry_price: form.actualEntryPrice,
    actual_stop_loss: form.actualStopLoss,
    actual_take_profit: form.actualTakeProfit,
    lot_size: form.lotSize,
    notes: form.notes,
    result_status: "open",
  };
}
