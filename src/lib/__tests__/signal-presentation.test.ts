import { describe, it, expect } from "vitest";
import {
  getBeginnerFriendlyTag,
  getAccountSuitability,
  getPrimaryRisk,
  getSignalAge,
  getPotentialLoss,
  SIGNAL_FRESH_THRESHOLD_MS,
  SIGNAL_STALE_THRESHOLD_MS,
} from "../signal-presentation";
import type { EnrichedSignal, PairAnalysis } from "@/types/trading";

// Minimal builder so each test reads as data, not setup noise.
function makeSignal(overrides: Partial<EnrichedSignal> = {}): EnrichedSignal {
  const baseAnalysis: PairAnalysis = {
    setupType: "Trend Pullback",
    direction: "long",
    entryZone: [1.085, 1.087],
    stopLoss: 1.08,
    tp1: 1.095,
    tp2: 1.1,
    tp3: 1.11,
    confidence: 75,
    setupQuality: "A",
    invalidation: "close below 1.08",
    beginnerExplanation: "Pullback to support, ride the trend.",
    expertExplanation: "EMA20>50>200, RSI 55, MACD>0.",
    reasonsFor: ["Trend alignment across H1/H4/D1", "MACD confirms direction"],
    reasonsAgainst: ["NFP risk later today", "Approaching weekly resistance"],
    noTradeReason: null,
    verdict: "trade",
  };
  return {
    id: "sig-1",
    pair: "EUR/USD",
    direction: "long",
    timeframe: "H4",
    entry_price: 1.086,
    stop_loss: 1.08,
    take_profit_1: 1.095,
    take_profit_2: 1.1,
    take_profit_3: 1.11,
    confidence: 75,
    verdict: "trade",
    status: "active",
    setup_type: "Trend Pullback",
    risk_reward: 2.5,
    ai_reasoning: "EMA20>50>200, RSI 55, MACD>0.",
    created_by_ai: true,
    invalidation_reason: "close below 1.08",
    created_at: "2026-04-25T10:00:00Z",
    updated_at: "2026-04-25T10:00:00Z",
    analysis: baseAnalysis,
    riskReward: 2.5,
    ...overrides,
  } as EnrichedSignal;
}

describe("getBeginnerFriendlyTag", () => {
  it("flags strong A-quality, high-confidence, 2R+ trades as friendly", () => {
    const result = getBeginnerFriendlyTag(makeSignal());
    expect(result.friendly).toBe(true);
    expect(result.reason).toContain("A");
    expect(result.reason).toContain("75%");
  });

  it("rejects no-trade verdicts outright", () => {
    const result = getBeginnerFriendlyTag(makeSignal({ verdict: "no_trade" }));
    expect(result.friendly).toBe(false);
    expect(result.reason).toContain("No-trade");
  });

  it("rejects low setup quality", () => {
    const sig = makeSignal({
      analysis: { ...(makeSignal().analysis as PairAnalysis), setupQuality: "C" },
    });
    const result = getBeginnerFriendlyTag(sig);
    expect(result.friendly).toBe(false);
    expect(result.reason).toContain("C");
  });

  it("rejects sub-70% confidence even when quality is A+", () => {
    const sig = makeSignal({
      confidence: 65,
      analysis: { ...(makeSignal().analysis as PairAnalysis), setupQuality: "A+" },
    });
    const result = getBeginnerFriendlyTag(sig);
    expect(result.friendly).toBe(false);
    expect(result.reason).toContain("65%");
  });

  it("rejects R:R below 2", () => {
    const result = getBeginnerFriendlyTag(makeSignal({ riskReward: 1.5 }));
    expect(result.friendly).toBe(false);
    expect(result.reason).toContain("1.5R");
  });
});

describe("getAccountSuitability", () => {
  it("returns 'real' for A+/A quality at 75%+ confidence", () => {
    expect(getAccountSuitability(makeSignal()).level).toBe("real");
  });

  it("returns 'no_trade' for no_trade verdict regardless of quality", () => {
    expect(getAccountSuitability(makeSignal({ verdict: "no_trade" })).level).toBe(
      "no_trade",
    );
  });

  it("returns 'demo_only' for B-quality setups", () => {
    const sig = makeSignal({
      analysis: { ...(makeSignal().analysis as PairAnalysis), setupQuality: "B" },
    });
    expect(getAccountSuitability(sig).level).toBe("demo_only");
  });

  it("returns 'demo_only' when confidence is below 75%", () => {
    expect(getAccountSuitability(makeSignal({ confidence: 70 })).level).toBe(
      "demo_only",
    );
  });
});

describe("getPrimaryRisk", () => {
  it("returns the first reasonsAgainst item when present", () => {
    const sig = makeSignal();
    expect(getPrimaryRisk(sig)).toBe("NFP risk later today");
  });

  it("trims whitespace on the picked reason", () => {
    const sig = makeSignal({
      analysis: {
        ...(makeSignal().analysis as PairAnalysis),
        reasonsAgainst: ["   Unusual spread   "],
      },
    });
    expect(getPrimaryRisk(sig)).toBe("Unusual spread");
  });

  it("falls back to low-confidence message when reasonsAgainst is empty", () => {
    const sig = makeSignal({
      confidence: 40,
      analysis: {
        ...(makeSignal().analysis as PairAnalysis),
        reasonsAgainst: [],
      },
    });
    const result = getPrimaryRisk(sig);
    expect(result).toContain("40%");
  });

  it("falls back to low-RR message when confidence is fine but RR is poor", () => {
    const sig = makeSignal({
      riskReward: 1.2,
      analysis: {
        ...(makeSignal().analysis as PairAnalysis),
        reasonsAgainst: [],
      },
    });
    const result = getPrimaryRisk(sig);
    expect(result).toContain("1.20R");
  });

  it("returns null when nothing notable is wrong", () => {
    const sig = makeSignal({
      analysis: {
        ...(makeSignal().analysis as PairAnalysis),
        reasonsAgainst: [],
      },
    });
    expect(getPrimaryRisk(sig)).toBeNull();
  });

  it("handles missing analysis gracefully", () => {
    const sig = makeSignal({ analysis: null, confidence: 30 });
    expect(getPrimaryRisk(sig)).toContain("30%");
  });
});

describe("getSignalAge", () => {
  const fixedNow = new Date("2026-04-25T12:00:00Z");
  const now = () => fixedNow;

  it("returns 'fresh' for a signal under 2h old", () => {
    const oneHourAgo = new Date(fixedNow.getTime() - 60 * 60 * 1000).toISOString();
    const result = getSignalAge({ created_at: oneHourAgo }, now);
    expect(result.staleness).toBe("fresh");
    expect(result.label).toBe("1h ago");
  });

  it("returns 'aging' for a signal between 2h and 6h", () => {
    const fourHoursAgo = new Date(
      fixedNow.getTime() - 4 * 60 * 60 * 1000,
    ).toISOString();
    expect(getSignalAge({ created_at: fourHoursAgo }, now).staleness).toBe(
      "aging",
    );
  });

  it("returns 'stale' for a signal older than 6h", () => {
    const eightHoursAgo = new Date(
      fixedNow.getTime() - 8 * 60 * 60 * 1000,
    ).toISOString();
    const result = getSignalAge({ created_at: eightHoursAgo }, now);
    expect(result.staleness).toBe("stale");
    expect(result.label).toBe("8h ago");
  });

  it("treats threshold boundaries deterministically", () => {
    const atFresh = new Date(
      fixedNow.getTime() - SIGNAL_FRESH_THRESHOLD_MS,
    ).toISOString();
    expect(getSignalAge({ created_at: atFresh }, now).staleness).toBe("aging");

    const atStale = new Date(
      fixedNow.getTime() - SIGNAL_STALE_THRESHOLD_MS,
    ).toISOString();
    expect(getSignalAge({ created_at: atStale }, now).staleness).toBe("stale");
  });

  it("formats labels in days for >24h", () => {
    const twoDaysAgo = new Date(
      fixedNow.getTime() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(getSignalAge({ created_at: twoDaysAgo }, now).label).toBe("2d ago");
  });

  it("formats sub-minute ages as 'just now'", () => {
    const tenSecAgo = new Date(fixedNow.getTime() - 10 * 1000).toISOString();
    expect(getSignalAge({ created_at: tenSecAgo }, now).label).toBe("just now");
  });

  it("returns stale + 'Unknown age' for missing timestamps", () => {
    const result = getSignalAge({ created_at: null }, now);
    expect(result.staleness).toBe("stale");
    expect(result.label).toBe("Unknown age");
  });

  it("handles future timestamps without going negative", () => {
    const future = new Date(fixedNow.getTime() + 10_000).toISOString();
    const result = getSignalAge({ created_at: future }, now);
    expect(result.ageMs).toBe(0);
    expect(result.staleness).toBe("fresh");
  });
});

describe("getPotentialLoss", () => {
  it("multiplies balance by risk %", () => {
    expect(getPotentialLoss(10_000, 1)).toEqual({
      riskUsd: 100,
      pctOfAccount: 1,
    });
    expect(getPotentialLoss(5_000, 2)).toEqual({
      riskUsd: 100,
      pctOfAccount: 2,
    });
  });

  it("rounds to 2 decimal places", () => {
    expect(getPotentialLoss(12_345.678, 1)?.riskUsd).toBe(123.46);
  });

  it("returns null for non-positive balance", () => {
    expect(getPotentialLoss(0, 1)).toBeNull();
    expect(getPotentialLoss(-100, 1)).toBeNull();
  });

  it("returns null for non-positive risk %", () => {
    expect(getPotentialLoss(10_000, 0)).toBeNull();
    expect(getPotentialLoss(10_000, -1)).toBeNull();
  });

  it("returns null for non-finite inputs", () => {
    expect(getPotentialLoss(NaN, 1)).toBeNull();
    expect(getPotentialLoss(10_000, Infinity)).toBeNull();
  });
});
