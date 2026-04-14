// Phase 18.4: shared P&L math used by the close-trade flow.
//
// Kept here rather than inside the dialog so it can be unit-tested
// independently. The math is intentionally pure — it takes primitives
// and returns primitives, no Supabase, no React.

import { pipMultiplier } from "@/lib/pip-value";
import type { TradeResultStatus } from "@/types/trading";

export interface TradePnlInput {
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  /** Pair symbol, used to pick the pip size (JPY pairs vs the rest). */
  pair: string;
  /** Lot size in standard lots (1.0 = 100k units). Optional. */
  lotSize?: number | null;
  /** Pip value in USD per standard lot. Optional but required for $ P&L. */
  pipValueUsdPerLot?: number | null;
  /** Account balance at close time — used to compute pnl_percent. */
  accountBalance?: number | null;
}

export interface TradePnlOutput {
  /** Price-distance result in pips (signed: positive = profit). */
  pips: number;
  /** P&L in USD; null when lot size or pip value is missing. */
  pnlUsd: number | null;
  /** P&L as a fraction of account balance (0.01 = 1%); null when missing. */
  pnlPercent: number | null;
  /** Classifies the trade as win / loss / breakeven for result_status. */
  resultStatus: TradeResultStatus;
}

/**
 * A small tolerance so floating-point noise doesn't flip a clean
 * breakeven exit into a 0.01-pip "loss".
 */
const BREAKEVEN_EPSILON_PIPS = 0.1;

export function computeTradePnl(input: TradePnlInput): TradePnlOutput {
  const { direction, entryPrice, exitPrice, pair, lotSize, pipValueUsdPerLot, accountBalance } =
    input;

  const priceDelta = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pips = priceDelta * pipMultiplier(pair);

  const pnlUsd =
    lotSize != null && lotSize > 0 && pipValueUsdPerLot != null
      ? pips * lotSize * pipValueUsdPerLot
      : null;

  const pnlPercent =
    pnlUsd != null && accountBalance != null && accountBalance > 0
      ? pnlUsd / accountBalance
      : null;

  let resultStatus: TradeResultStatus;
  if (pips > BREAKEVEN_EPSILON_PIPS) resultStatus = "win";
  else if (pips < -BREAKEVEN_EPSILON_PIPS) resultStatus = "loss";
  else resultStatus = "breakeven";

  return { pips, pnlUsd, pnlPercent, resultStatus };
}
