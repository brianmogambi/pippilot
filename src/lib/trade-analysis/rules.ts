// Phase 18.5: individual rule checks.
//
// Each function takes the TradeAnalysisInput and, if the rule fires,
// returns { flag, detail } describing what was detected. When a rule
// does not apply (e.g. no planned stop loss), it returns null.
//
// Thresholds are expressed as fractions of the PLANNED RISK DISTANCE
// (|plannedEntryMid - plannedStopLoss|) rather than pip constants,
// because every pair + timeframe has a different meaningful drift.
// A 5-pip drift on EUR/USD M15 is massive; the same on XAU/USD H4
// is noise. Scaling to the setup's own risk distance keeps the
// rules calibration-free.

import type { TradeAnalysisFlag, TradeAnalysisInput } from "./types";

export interface RuleHit {
  flag: TradeAnalysisFlag;
  detail: Record<string, unknown>;
}

/** 20% of planned risk counts as "meaningful drift". */
const DRIFT_FRACTION = 0.2;

/** Stop-distance needs to differ by 20% to count as tighter/wider. */
const STOP_DISTANCE_FRACTION = 0.2;

/** R:R needs to differ by 20% to count as reduced/improved. */
const RR_FRACTION = 0.2;

function plannedEntryMid(input: TradeAnalysisInput): number | null {
  const low = input.plannedEntryLow;
  const high = input.plannedEntryHigh;
  if (low == null || high == null) return null;
  return (low + high) / 2;
}

function plannedRiskDistance(input: TradeAnalysisInput): number | null {
  const mid = plannedEntryMid(input);
  if (mid == null || input.plannedStopLoss == null) return null;
  return Math.abs(mid - input.plannedStopLoss);
}

function actualRiskDistance(input: TradeAnalysisInput): number | null {
  if (input.actualStopLoss == null) return null;
  return Math.abs(input.actualEntry - input.actualStopLoss);
}

function plannedRR(input: TradeAnalysisInput): number | null {
  const risk = plannedRiskDistance(input);
  const mid = plannedEntryMid(input);
  if (risk == null || risk === 0 || mid == null || input.plannedTakeProfit1 == null) {
    return null;
  }
  const reward = Math.abs(input.plannedTakeProfit1 - mid);
  return reward / risk;
}

function actualRR(input: TradeAnalysisInput): number | null {
  const risk = actualRiskDistance(input);
  if (risk == null || risk === 0 || input.actualTakeProfit == null) return null;
  const reward = Math.abs(input.actualTakeProfit - input.actualEntry);
  return reward / risk;
}

/**
 * Long: actual entry meaningfully above the planned zone high.
 * Short: actual entry meaningfully below the planned zone low.
 * "Meaningfully" = > DRIFT_FRACTION of planned risk distance.
 */
export function checkLateEntry(input: TradeAnalysisInput): RuleHit | null {
  const risk = plannedRiskDistance(input);
  if (risk == null || risk === 0) return null;

  const tolerance = risk * DRIFT_FRACTION;

  if (input.direction === "long") {
    if (input.plannedEntryHigh == null) return null;
    const drift = input.actualEntry - input.plannedEntryHigh;
    if (drift > tolerance) {
      return {
        flag: "late_entry",
        detail: {
          drift,
          tolerance,
          plannedZoneHigh: input.plannedEntryHigh,
          actualEntry: input.actualEntry,
        },
      };
    }
  } else {
    if (input.plannedEntryLow == null) return null;
    const drift = input.plannedEntryLow - input.actualEntry;
    if (drift > tolerance) {
      return {
        flag: "late_entry",
        detail: {
          drift,
          tolerance,
          plannedZoneLow: input.plannedEntryLow,
          actualEntry: input.actualEntry,
        },
      };
    }
  }
  return null;
}

/**
 * Opposite of late: long entry meaningfully BELOW planned zone low,
 * short entry meaningfully ABOVE planned zone high.
 */
export function checkEarlyEntry(input: TradeAnalysisInput): RuleHit | null {
  const risk = plannedRiskDistance(input);
  if (risk == null || risk === 0) return null;

  const tolerance = risk * DRIFT_FRACTION;

  if (input.direction === "long") {
    if (input.plannedEntryLow == null) return null;
    const drift = input.plannedEntryLow - input.actualEntry;
    if (drift > tolerance) {
      return {
        flag: "early_entry",
        detail: {
          drift,
          tolerance,
          plannedZoneLow: input.plannedEntryLow,
          actualEntry: input.actualEntry,
        },
      };
    }
  } else {
    if (input.plannedEntryHigh == null) return null;
    const drift = input.actualEntry - input.plannedEntryHigh;
    if (drift > tolerance) {
      return {
        flag: "early_entry",
        detail: {
          drift,
          tolerance,
          plannedZoneHigh: input.plannedEntryHigh,
          actualEntry: input.actualEntry,
        },
      };
    }
  }
  return null;
}

/**
 * Actual stop distance materially TIGHTER than planned.
 * Tighter = closer to entry = less invalidation room.
 */
export function checkTighterStop(input: TradeAnalysisInput): RuleHit | null {
  const plannedDist = plannedRiskDistance(input);
  const actualDist = actualRiskDistance(input);
  if (plannedDist == null || actualDist == null || plannedDist === 0) return null;

  if (actualDist < plannedDist * (1 - STOP_DISTANCE_FRACTION)) {
    return {
      flag: "tighter_stop_than_plan",
      detail: {
        plannedDist,
        actualDist,
        delta: actualDist - plannedDist,
      },
    };
  }
  return null;
}

/**
 * Actual stop distance materially WIDER than planned.
 * Wider = further from entry = more risk than the signal implied.
 */
export function checkWiderStop(input: TradeAnalysisInput): RuleHit | null {
  const plannedDist = plannedRiskDistance(input);
  const actualDist = actualRiskDistance(input);
  if (plannedDist == null || actualDist == null || plannedDist === 0) return null;

  if (actualDist > plannedDist * (1 + STOP_DISTANCE_FRACTION)) {
    return {
      flag: "wider_stop_than_plan",
      detail: {
        plannedDist,
        actualDist,
        delta: actualDist - plannedDist,
      },
    };
  }
  return null;
}

/** Actual R:R materially worse than planned. */
export function checkReducedRR(input: TradeAnalysisInput): RuleHit | null {
  const planned = plannedRR(input);
  const actual = actualRR(input);
  if (planned == null || actual == null) return null;
  if (actual < planned * (1 - RR_FRACTION)) {
    return {
      flag: "reduced_rr",
      detail: { plannedRR: planned, actualRR: actual },
    };
  }
  return null;
}

/** Actual R:R materially better than planned. */
export function checkImprovedRR(input: TradeAnalysisInput): RuleHit | null {
  const planned = plannedRR(input);
  const actual = actualRR(input);
  if (planned == null || actual == null) return null;
  if (actual > planned * (1 + RR_FRACTION)) {
    return {
      flag: "improved_rr",
      detail: { plannedRR: planned, actualRR: actual },
    };
  }
  return null;
}

/**
 * Self-report + rule corroboration. Only fires if the user both
 * reported followed_plan=true AND no drift rule fired. The caller
 * passes the already-computed drift flags so we don't re-run them.
 */
export function checkFollowedPlan(
  input: TradeAnalysisInput,
  driftFlags: TradeAnalysisFlag[],
): RuleHit | null {
  if (input.followedPlan !== true) return null;
  if (driftFlags.length > 0) return null;
  return { flag: "followed_plan", detail: {} };
}

/** Inverse of followed_plan — fires on either signal. */
export function checkDeviatedFromPlan(
  input: TradeAnalysisInput,
  driftFlags: TradeAnalysisFlag[],
): RuleHit | null {
  const reported = input.followedPlan === false;
  if (!reported && driftFlags.length === 0) return null;
  return {
    flag: "deviated_from_plan",
    detail: {
      selfReported: reported,
      driftFlags,
    },
  };
}

/**
 * Loss + no execution drift + not invalidated = the setup played
 * out normally and the signal lost on its own merits. This is the
 * "in-plan loss" bucket that coaching should NOT frame as a mistake.
 */
export function checkSetupFailedNormally(
  input: TradeAnalysisInput,
  driftFlags: TradeAnalysisFlag[],
): RuleHit | null {
  if (input.resultStatus !== "loss") return null;
  if (driftFlags.length > 0) return null;
  if (input.liveSignalStatus === "invalidated") return null;
  if (!input.signalLinked) return null;
  return { flag: "setup_failed_normally", detail: {} };
}

/** Live signal reached its invalidation before the trade resolved. */
export function checkSignalInvalidated(input: TradeAnalysisInput): RuleHit | null {
  if (input.liveSignalStatus !== "invalidated") return null;
  return { flag: "signal_invalidated", detail: {} };
}

/**
 * Loss that is attributable to execution rather than the signal.
 * Fires when a loss coincides with any late/tighter/reduced-rr
 * flag, or with certain mistake tags the trader self-reported.
 */
export function checkProbableExecutionError(
  input: TradeAnalysisInput,
  driftFlags: TradeAnalysisFlag[],
): RuleHit | null {
  if (input.resultStatus !== "loss") return null;

  const execDrift = driftFlags.some((f) =>
    (
      [
        "late_entry",
        "tighter_stop_than_plan",
        "reduced_rr",
      ] as TradeAnalysisFlag[]
    ).includes(f),
  );

  const execMistakes = (input.mistakeTags ?? []).some((tag) =>
    [
      "moved_stop_loss",
      "moved_take_profit",
      "late_entry",
      "early_entry",
      "oversized",
    ].includes(tag),
  );

  if (!execDrift && !execMistakes) return null;
  return {
    flag: "probable_execution_error",
    detail: { execDrift, execMistakes },
  };
}
