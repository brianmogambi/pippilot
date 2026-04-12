// Phase 10: Pure replay loop.
//
// Iterates a cursor across the configured base timeframe, asks an injected
// signal engine for a decision at each step using ONLY data sliced at or
// before the cursor (no lookahead), and resolves outcomes against the
// remaining future candles.
//
// The engine function is injected so this loop can be:
//   - unit-tested with a stubbed engine (vitest)
//   - run from the Deno edge function with the real signal-engine adapter

// Deno mirror — keep in sync with src/lib/backtest/replay-loop.ts.
import {
  futureCandlesAfter,
  sliceAtCursor,
} from "./slice-timeframe.ts";
import { resolveOutcome } from "./outcome-resolver.ts";
import type {
  BacktestCandle,
  BacktestSignalRow,
  PairCandleSet,
  ResolvedOutcome,
  ResolverSignal,
  SignalWithOutcome,
} from "./types.ts";

// What the injected engine returns at a given cursor. The replay loop only
// needs the fields necessary to (a) persist as a backtest_signals row and
// (b) feed the resolver. The Deno adapter maps SignalOutput → EngineDecision.
export interface EngineDecision {
  pair: string;
  timeframe: string;
  direction: "long" | "short";
  setupType: string;
  setupQuality: string | null;
  verdict: "trade" | "no_trade";
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskReward: number;
  reasonsFor: string[];
  reasonsAgainst: string[];
  invalidation: string;
}

export type EngineFn = (
  pair: string,
  data: PairCandleSet,
  cursorISO: string,
) => EngineDecision | null;

export interface ReplayPairInput {
  pair: string;
  candles: PairCandleSet;
  pipSize: number;
}

export interface ReplayConfig {
  baseTimeframe: "1h" | "4h";
  startDate: string;
  endDate: string;
  maxHoldingBars: number;
}

export interface ReplayResult {
  items: SignalWithOutcome[];
}

/**
 * Run the replay loop for one pair. Pure: no DB, no network.
 *
 * Dedup: once a `trade` verdict signal is generated for the pair, no new
 * signals are emitted until that trade resolves (TP/SL/expired). Mirrors
 * the live engine's "one active signal per pair" behavior.
 */
export function runReplayForPair(
  input: ReplayPairInput,
  config: ReplayConfig,
  engine: EngineFn,
): ReplayResult {
  const items: SignalWithOutcome[] = [];
  const baseCandles = config.baseTimeframe === "1h" ? input.candles.h1 : input.candles.h4;

  const startMs = Date.parse(config.startDate);
  const endMs = Date.parse(config.endDate);

  // Pre-compute cursor list: every base-timeframe close in [startDate, endDate].
  const cursors: string[] = [];
  for (const c of baseCandles) {
    const t = Date.parse(c.time);
    if (t >= startMs && t <= endMs) cursors.push(c.time);
  }

  // Active trade lock: while non-null, a previously-emitted signal is still
  // unresolved at this cursor. Tracks the cursor index at which it was
  // emitted plus the resolved-at time, so we can release the lock when the
  // cursor passes the resolution time.
  let activeUntilMs: number | null = null;

  for (const cursorISO of cursors) {
    const cursorMs = Date.parse(cursorISO);

    // Release lock if previous trade has resolved by this cursor.
    if (activeUntilMs !== null && cursorMs > activeUntilMs) {
      activeUntilMs = null;
    }
    if (activeUntilMs !== null) continue;

    const sliced = sliceAtCursor(input.candles, cursorISO);
    const decision = engine(input.pair, sliced, cursorISO);
    if (!decision) continue;

    const futureBase = futureCandlesAfter(baseCandles, cursorISO);
    let outcome: ResolvedOutcome;

    if (decision.verdict === "trade") {
      const resolverSignal: ResolverSignal = {
        direction: decision.direction,
        entryPrice: decision.entryPrice,
        stopLoss: decision.stopLoss,
        tp1: decision.tp1,
        tp2: decision.tp2,
        tp3: decision.tp3,
      };
      outcome = resolveOutcome(resolverSignal, futureBase, {
        maxBars: config.maxHoldingBars,
        pipSize: input.pipSize,
      });

      // Lock further emissions until resolution.
      if (outcome.kind !== "no_entry") {
        activeUntilMs = Date.parse(outcome.resolvedAt);
      }
    } else {
      outcome = {
        kind: "no_entry",
        entryHitAt: null,
        resolvedAt: cursorISO,
        barsToResolution: 0,
        exitPrice: null,
        rMultiple: null,
        pipsResult: null,
        path: [],
      };
    }

    const row: BacktestSignalRow = {
      pair: decision.pair,
      timeframe: decision.timeframe,
      direction: decision.direction,
      setupType: decision.setupType,
      setupQuality: decision.setupQuality,
      verdict: decision.verdict,
      confidence: decision.confidence,
      entryPrice: decision.entryPrice,
      stopLoss: decision.stopLoss,
      tp1: decision.tp1,
      tp2: decision.tp2,
      tp3: decision.tp3,
      riskReward: decision.riskReward,
      cursorTime: cursorISO,
      reasonsFor: decision.reasonsFor,
      reasonsAgainst: decision.reasonsAgainst,
      invalidation: decision.invalidation,
    };

    items.push({ signal: row, outcome });
  }

  return { items };
}

// Convenience: run replay for many pairs and concatenate results.
export function runReplay(
  pairs: ReplayPairInput[],
  config: ReplayConfig,
  engine: EngineFn,
): ReplayResult {
  const all: SignalWithOutcome[] = [];
  for (const p of pairs) {
    const r = runReplayForPair(p, config, engine);
    all.push(...r.items);
  }
  return { items: all };
}

// Re-exported for the Deno adapter — never used directly outside.
export { resolveOutcome, sliceAtCursor, futureCandlesAfter };
export type { BacktestCandle };
