// Phase 11: Equity curve — cumulative R-multiple over chronologically
// resolved trades. Pure / deterministic.
//
// Mirrors the local walk inside `src/lib/backtest/metrics.ts:92-100` but
// extracted as a reusable function. The metrics module's max-drawdown
// calculation is intentionally left intact — `equity-curve.ts` is the
// presentation-friendly version that returns each trade as a point so the
// UI can plot it.

import type { SignalWithOutcome } from "../backtest/types";
import type { EquityPoint } from "./types";

/**
 * Walk a list of `SignalWithOutcome` items in chronological order
 * (by `signal.cursorTime`) and accumulate R-multiples into an equity curve.
 *
 * Only resolved trades contribute (we use `outcome.rMultiple ?? 0`, so
 * `no_entry` rows with null R contribute nothing). The result is suitable
 * for charting and drawdown analysis.
 */
export function computeEquityCurve(items: SignalWithOutcome[]): EquityPoint[] {
  const chronological = [...items].sort(
    (a, b) => Date.parse(a.signal.cursorTime) - Date.parse(b.signal.cursorTime),
  );

  const points: EquityPoint[] = [];
  let equityR = 0;

  for (const { outcome } of chronological) {
    const tradeR = outcome.rMultiple ?? 0;
    equityR = round(equityR + tradeR, 4);
    points.push({
      time: outcome.resolvedAt,
      equityR,
      tradeR: round(tradeR, 4),
    });
  }

  return points;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
