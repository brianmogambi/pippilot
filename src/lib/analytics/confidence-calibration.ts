// Phase 11: Confidence calibration.
//
// Buckets every actionable signal (verdict='trade') by its confidence
// score, then reports realized win rate and average R per bucket. The
// purpose is to answer: "does our 80+ confidence band actually outperform
// our 60–80 band?" — if not, the engine's confidence scoring is
// miscalibrated and Phase 13 (recalibration) is justified.
//
// Pure & deterministic.

import type { SignalWithOutcome } from "../backtest/types";
import { MIN_SAMPLE_SIZE, type ConfidenceBucket } from "./types";

const WIN_KINDS = new Set(["tp1_hit", "tp2_hit", "tp3_hit"]);
const LOSS_KINDS = new Set(["sl_hit"]);

/**
 * Bucket boundaries are [min, max) — except the top bucket which is
 * inclusive of 100. We use four bands chosen to map to the engine's
 * "low / medium / high / very_high" confidence labels.
 */
const BUCKETS: Array<{ minConfidence: number; maxConfidence: number }> = [
  { minConfidence: 0, maxConfidence: 40 },
  { minConfidence: 40, maxConfidence: 60 },
  { minConfidence: 60, maxConfidence: 80 },
  { minConfidence: 80, maxConfidence: 101 },
];

export function computeConfidenceBuckets(
  items: SignalWithOutcome[],
): ConfidenceBucket[] {
  const buckets: ConfidenceBucket[] = BUCKETS.map((b) => ({
    ...b,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgR: 0,
    insufficientSample: true,
  }));

  // Per-bucket totalR accumulator (kept out of the public type since avgR
  // is the value consumers care about).
  const totalR: number[] = buckets.map(() => 0);

  for (const { signal, outcome } of items) {
    // Only actionable signals: a no_trade verdict has no realized R to
    // calibrate against. The no-trade quality module covers those.
    if (signal.verdict !== "trade") continue;
    if (outcome.kind === "no_entry") continue;

    const idx = pickBucket(signal.confidence);
    if (idx < 0) continue;

    const bucket = buckets[idx];
    bucket.trades++;
    totalR[idx] += outcome.rMultiple ?? 0;

    if (WIN_KINDS.has(outcome.kind)) bucket.wins++;
    else if (LOSS_KINDS.has(outcome.kind)) bucket.losses++;
  }

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    const resolved = b.wins + b.losses;
    b.winRate = resolved > 0 ? round(b.wins / resolved, 4) : 0;
    b.avgR = b.trades > 0 ? round(totalR[i] / b.trades, 4) : 0;
    b.insufficientSample = b.trades < MIN_SAMPLE_SIZE;
  }

  return buckets;
}

function pickBucket(confidence: number): number {
  for (let i = 0; i < BUCKETS.length; i++) {
    const b = BUCKETS[i];
    if (confidence >= b.minConfidence && confidence < b.maxConfidence) return i;
  }
  return -1;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
