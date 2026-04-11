import { describe, it, expect } from "vitest";
import {
  RISK_THRESHOLDS,
  calculateRiskAmount,
  calculatePipDistance,
  calculateLotSize,
  applyConservativeMode,
  calculateExposureUnits,
  calculateMoneyAtRiskUSD,
  calculateOpenRiskUSD,
  validateTradeInputs,
  evaluateTrade,
  evaluatePropFirmRules,
  noopCorrelatedExposureCheck,
  type AccountState,
  type RiskProfile,
  type TradeInputs,
  type DailyState,
  type OpenPosition,
} from "../risk-engine";

const baseAccount: AccountState = {
  balance: 10_000,
  equity: 10_000,
  currency: "USD",
};

const baseProfile: RiskProfile = {
  riskPerTradePct: 1,
  maxDailyLossPct: 5,
  maxTotalOpenRiskPct: 10,
  conservativeMode: false,
};

const baseTrade: TradeInputs = {
  pair: "EUR/USD",
  entry: 1.1000,
  stopLoss: 1.0950, // 50 pips
  pipValueUSD: 10,
  riskMode: "percent",
};

const flatDaily: DailyState = { realizedLossUSD: 0, openRiskUSD: 0 };

describe("calculateRiskAmount", () => {
  it("percent mode: balance × pct / 100", () => {
    expect(calculateRiskAmount(baseAccount, baseProfile, "percent")).toBe(100);
  });

  it("fixed mode overrides percent when value > 0", () => {
    expect(calculateRiskAmount(baseAccount, baseProfile, "fixed", 250)).toBe(250);
  });

  it("fixed mode falls back to percent when fixedAmount is 0 or undefined", () => {
    expect(calculateRiskAmount(baseAccount, baseProfile, "fixed", 0)).toBe(100);
    expect(calculateRiskAmount(baseAccount, baseProfile, "fixed", undefined)).toBe(100);
  });
});

describe("calculatePipDistance", () => {
  it("non-JPY pair: 50 pips", () => {
    expect(calculatePipDistance("EUR/USD", 1.1050, 1.1000)).toBeCloseTo(50, 6);
  });

  it("JPY pair: 50 pips", () => {
    expect(calculatePipDistance("USD/JPY", 150.50, 150.00)).toBeCloseTo(50, 6);
  });

  it("identical entry and SL → 0", () => {
    expect(calculatePipDistance("EUR/USD", 1.1, 1.1)).toBe(0);
  });
});

describe("calculateLotSize", () => {
  it("normal: 100 / (50 * 10) = 0.20", () => {
    expect(calculateLotSize(100, 50, 10)).toBeCloseTo(0.20, 6);
  });

  it("returns 0 when pipDistance ≤ 0", () => {
    expect(calculateLotSize(100, 0, 10)).toBe(0);
    expect(calculateLotSize(100, -1, 10)).toBe(0);
  });

  it("returns 0 when pipValue ≤ 0", () => {
    expect(calculateLotSize(100, 50, 0)).toBe(0);
    expect(calculateLotSize(100, 50, -1)).toBe(0);
  });
});

describe("applyConservativeMode", () => {
  it("off → unchanged", () => {
    expect(applyConservativeMode(0.20, false)).toBe(0.20);
  });

  it("on → halved", () => {
    expect(applyConservativeMode(0.20, true)).toBe(0.10);
  });
});

describe("calculateExposureUnits", () => {
  it("multiplies lot by 100,000", () => {
    expect(calculateExposureUnits(0.20)).toBe(20_000);
  });
});

describe("calculateMoneyAtRiskUSD", () => {
  it("lot × pipDistance × pipValue", () => {
    expect(calculateMoneyAtRiskUSD(0.20, 50, 10)).toBeCloseTo(100, 6);
  });

  it("returns 0 for zero/negative inputs", () => {
    expect(calculateMoneyAtRiskUSD(0, 50, 10)).toBe(0);
    expect(calculateMoneyAtRiskUSD(0.2, 0, 10)).toBe(0);
    expect(calculateMoneyAtRiskUSD(0.2, 50, 0)).toBe(0);
  });
});

describe("calculateOpenRiskUSD", () => {
  it("sums money-at-risk across positions", () => {
    const positions: OpenPosition[] = [
      { pair: "EUR/USD", lotSize: 0.20, entry: 1.10, stopLoss: 1.0950, pipValueUSD: 10 }, // 100
      { pair: "GBP/USD", lotSize: 0.10, entry: 1.27, stopLoss: 1.2650, pipValueUSD: 10 }, // 50
    ];
    expect(calculateOpenRiskUSD(positions)).toBeCloseTo(150, 6);
  });

  it("ignores positions with non-positive lot/distance/pip-value", () => {
    const positions: OpenPosition[] = [
      { pair: "EUR/USD", lotSize: 0, entry: 1.10, stopLoss: 1.0950, pipValueUSD: 10 },
      { pair: "GBP/USD", lotSize: 0.10, entry: 1.27, stopLoss: 1.27, pipValueUSD: 10 },
      { pair: "AUD/USD", lotSize: 0.10, entry: 0.63, stopLoss: 0.625, pipValueUSD: 0 },
    ];
    expect(calculateOpenRiskUSD(positions)).toBe(0);
  });
});

describe("validateTradeInputs", () => {
  it("flags balance ≤ 0", () => {
    const errors = validateTradeInputs({ ...baseAccount, balance: 0 }, baseTrade, baseProfile);
    expect(errors.balance).toBeDefined();
  });

  it("flags missing entry / SL", () => {
    const errors = validateTradeInputs(baseAccount, { ...baseTrade, entry: 0, stopLoss: 0 }, baseProfile);
    expect(errors.entry).toBeDefined();
    expect(errors.stopLoss).toBeDefined();
  });

  it("flags entry === SL", () => {
    const errors = validateTradeInputs(baseAccount, { ...baseTrade, stopLoss: 1.1000 }, baseProfile);
    expect(errors.stopLoss).toBeDefined();
  });

  it("flags riskPct out of range", () => {
    expect(validateTradeInputs(baseAccount, baseTrade, { ...baseProfile, riskPerTradePct: 0.05 }).riskPct).toBeDefined();
    expect(validateTradeInputs(baseAccount, baseTrade, { ...baseProfile, riskPerTradePct: 11 }).riskPct).toBeDefined();
  });

  it("flags non-positive pip value", () => {
    const errors = validateTradeInputs(baseAccount, { ...baseTrade, pipValueUSD: 0 }, baseProfile);
    expect(errors.pipValue).toBeDefined();
  });

  it("clean inputs → no errors", () => {
    expect(validateTradeInputs(baseAccount, baseTrade, baseProfile)).toEqual({});
  });
});

describe("evaluateTrade", () => {
  it("happy path: 1% on $10k EUR/USD with 50-pip SL", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: baseProfile,
      trade: baseTrade,
      daily: flatDaily,
    });
    expect(r.riskAmountUSD).toBeCloseTo(100, 6);
    expect(r.pipDistance).toBeCloseTo(50, 6);
    expect(r.rawLotSize).toBeCloseTo(0.20, 6);
    expect(r.lotSize).toBeCloseTo(0.20, 6);
    expect(r.exposureUnits).toBeCloseTo(20_000, 6);
    expect(r.blocked).toBe(false);
    // No info/warn beyond what the rules emit; conservative is off
    expect(r.warnings.find((w) => w.code === "conservative_mode_active")).toBeUndefined();
  });

  it("conservative mode halves lot but leaves riskAmount untouched", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: { ...baseProfile, conservativeMode: true },
      trade: baseTrade,
      daily: flatDaily,
    });
    expect(r.riskAmountUSD).toBeCloseTo(100, 6);
    expect(r.rawLotSize).toBeCloseTo(0.20, 6);
    expect(r.lotSize).toBeCloseTo(0.10, 6);
    expect(r.warnings.some((w) => w.code === "conservative_mode_active")).toBe(true);
    expect(r.warnings.find((w) => w.code === "conservative_mode_active")?.level).toBe("info");
  });

  it("total open risk > 5% → blocked with exceeds_safety_threshold", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: baseProfile,
      trade: baseTrade,
      daily: { realizedLossUSD: 0, openRiskUSD: 500 }, // + new 100 = 600 → 6%
    });
    expect(r.totalOpenRiskPctAfterTrade).toBeCloseTo(6, 6);
    expect(r.blocked).toBe(true);
    expect(r.warnings.some((w) => w.code === "exceeds_safety_threshold" && w.level === "block")).toBe(true);
  });

  it("total open risk between 3% and 5% → warn only, not blocked", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: baseProfile,
      trade: baseTrade,
      daily: { realizedLossUSD: 0, openRiskUSD: 300 }, // + 100 = 400 → 4%
    });
    expect(r.totalOpenRiskPctAfterTrade).toBeCloseTo(4, 6);
    expect(r.blocked).toBe(false);
    expect(r.warnings.some((w) => w.code === "exceeds_daily_loss_guideline" && w.level === "warn")).toBe(true);
  });

  it("profile cap exceeded → blocked with exceeds_total_open_risk_profile", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: { ...baseProfile, maxTotalOpenRiskPct: 4 },
      trade: baseTrade,
      daily: { realizedLossUSD: 0, openRiskUSD: 350 }, // + 100 = 450 → 4.5%
    });
    expect(r.blocked).toBe(true);
    expect(r.warnings.some((w) => w.code === "exceeds_total_open_risk_profile" && w.level === "block")).toBe(true);
  });

  it("daily loss exceeds profile cap → blocked with exceeds_daily_loss_profile", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: { ...baseProfile, maxDailyLossPct: 2 },
      trade: baseTrade,
      daily: { realizedLossUSD: 250, openRiskUSD: 0 }, // 2.5% > 2%
    });
    expect(r.blocked).toBe(true);
    expect(r.warnings.some((w) => w.code === "exceeds_daily_loss_profile" && w.level === "block")).toBe(true);
  });

  it("validation error (entry === SL) → blocked with validation_error", () => {
    const r = evaluateTrade({
      account: baseAccount,
      profile: baseProfile,
      trade: { ...baseTrade, stopLoss: baseTrade.entry },
      daily: flatDaily,
    });
    expect(r.blocked).toBe(true);
    expect(r.warnings.some((w) => w.code === "validation_error" && w.level === "block")).toBe(true);
  });

  it("numerical parity: canonical RISK_ENGINE_SPEC scenario", () => {
    // 1% / $10,000 / EUR/USD / 50-pip SL ⇒ Max Risk $100, Lot 0.20, Exposure 20,000
    const r = evaluateTrade({
      account: baseAccount,
      profile: baseProfile,
      trade: baseTrade,
      daily: flatDaily,
    });
    expect(r.riskAmountUSD).toBe(100);
    expect(r.lotSize).toBeCloseTo(0.20, 6);
    expect(r.exposureUnits).toBeCloseTo(20_000, 6);
  });

  it("uses RISK_THRESHOLDS constants, not magic numbers", () => {
    expect(RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT).toBe(5);
    expect(RISK_THRESHOLDS.DAILY_LOSS_GUIDELINE_PCT).toBe(3);
    expect(RISK_THRESHOLDS.CONSERVATIVE_LOT_MULTIPLIER).toBe(0.5);
    expect(RISK_THRESHOLDS.STANDARD_LOT_UNITS).toBe(100_000);
  });
});

describe("placeholders", () => {
  it("noopCorrelatedExposureCheck.evaluate returns null", () => {
    expect(noopCorrelatedExposureCheck.evaluate([], baseTrade)).toBeNull();
  });

  it("evaluatePropFirmRules(null, ...) returns passed: true with no warnings", () => {
    const result = evaluatePropFirmRules(null, { dailyLossUSD: 0, totalLossUSD: 0, lotSize: 0 });
    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
