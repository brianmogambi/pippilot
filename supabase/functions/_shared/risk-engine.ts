// supabase/functions/_shared/risk-engine.ts
//
// Deno mirror of src/lib/risk-engine.ts — keep in sync. The only
// difference from the src/lib copy is the explicit `.ts` extension on
// the relative import (Deno requires it).

import { pipMultiplier } from "./pip-value.ts";

// ── Constants ───────────────────────────────────────────────────

export const RISK_THRESHOLDS = {
  MIN_RISK_PCT: 0.1,
  MAX_RISK_PCT: 10,
  TOTAL_OPEN_RISK_SAFETY_PCT: 5,
  DAILY_LOSS_GUIDELINE_PCT: 3,
  CONSERVATIVE_LOT_MULTIPLIER: 0.5,
  STANDARD_LOT_UNITS: 100_000,
} as const;

// ── Types ───────────────────────────────────────────────────────

export type RiskMode = "percent" | "fixed";

export interface AccountState {
  balance: number;
  equity: number;
  currency: string;
}

export interface RiskProfile {
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxTotalOpenRiskPct: number;
  conservativeMode: boolean;
}

export interface TradeInputs {
  pair: string;
  entry: number;
  stopLoss: number;
  pipValueUSD: number;
  riskMode: RiskMode;
  fixedRiskAmount?: number;
}

export interface OpenPosition {
  pair: string;
  lotSize: number;
  entry: number;
  stopLoss: number;
  pipValueUSD: number;
}

export interface DailyState {
  realizedLossUSD: number;
  openRiskUSD: number;
}

export type RiskWarningCode =
  | "exceeds_safety_threshold"
  | "exceeds_total_open_risk_profile"
  | "exceeds_daily_loss_guideline"
  | "exceeds_daily_loss_profile"
  | "conservative_mode_active"
  | "validation_error"
  | "correlated_exposure"
  | "prop_firm_rule";

export interface RiskWarning {
  level: "info" | "warn" | "block";
  code: RiskWarningCode;
  message: string;
}

export interface RiskValidationErrors {
  balance?: string;
  entry?: string;
  stopLoss?: string;
  riskPct?: string;
  pipValue?: string;
}

export interface RiskEvaluation {
  riskAmountUSD: number;
  pipDistance: number;
  rawLotSize: number;
  lotSize: number;
  exposureUnits: number;
  totalOpenRiskUSDAfterTrade: number;
  totalOpenRiskPctAfterTrade: number;
  dailyLossPct: number;
  blocked: boolean;
  warnings: RiskWarning[];
  validationErrors: RiskValidationErrors;
}

// ── Pure functions ──────────────────────────────────────────────

export function calculateRiskAmount(
  account: AccountState,
  profile: RiskProfile,
  mode: RiskMode,
  fixedAmount?: number,
): number {
  if (mode === "fixed" && fixedAmount != null && fixedAmount > 0) {
    return fixedAmount;
  }
  return account.balance * (profile.riskPerTradePct / 100);
}

export function calculatePipDistance(
  pair: string,
  entry: number,
  stopLoss: number,
): number {
  return Math.abs(entry - stopLoss) * pipMultiplier(pair);
}

export function calculateLotSize(
  riskAmountUSD: number,
  pipDistance: number,
  pipValueUSD: number,
): number {
  if (pipDistance <= 0 || pipValueUSD <= 0) return 0;
  return riskAmountUSD / (pipDistance * pipValueUSD);
}

export function applyConservativeMode(
  rawLotSize: number,
  conservative: boolean,
): number {
  return conservative
    ? rawLotSize * RISK_THRESHOLDS.CONSERVATIVE_LOT_MULTIPLIER
    : rawLotSize;
}

export function calculateExposureUnits(lotSize: number): number {
  return lotSize * RISK_THRESHOLDS.STANDARD_LOT_UNITS;
}

export function calculateMoneyAtRiskUSD(
  lotSize: number,
  pipDistance: number,
  pipValueUSD: number,
): number {
  if (lotSize <= 0 || pipDistance <= 0 || pipValueUSD <= 0) return 0;
  return lotSize * pipDistance * pipValueUSD;
}

export function calculateOpenRiskUSD(positions: readonly OpenPosition[]): number {
  let total = 0;
  for (const p of positions) {
    const dist = calculatePipDistance(p.pair, p.entry, p.stopLoss);
    total += calculateMoneyAtRiskUSD(p.lotSize, dist, p.pipValueUSD);
  }
  return total;
}

export function validateTradeInputs(
  account: AccountState,
  trade: TradeInputs,
  profile: RiskProfile,
): RiskValidationErrors {
  const errors: RiskValidationErrors = {};
  if (account.balance <= 0) errors.balance = "Must be positive";
  if (!trade.entry || trade.entry <= 0) errors.entry = "Required";
  if (!trade.stopLoss || trade.stopLoss <= 0) errors.stopLoss = "Required";
  if (trade.entry && trade.stopLoss && trade.entry === trade.stopLoss) {
    errors.stopLoss = "Must differ from entry";
  }
  if (
    profile.riskPerTradePct < RISK_THRESHOLDS.MIN_RISK_PCT ||
    profile.riskPerTradePct > RISK_THRESHOLDS.MAX_RISK_PCT
  ) {
    errors.riskPct = `${RISK_THRESHOLDS.MIN_RISK_PCT}% – ${RISK_THRESHOLDS.MAX_RISK_PCT}%`;
  }
  if (trade.pipValueUSD <= 0) errors.pipValue = "Must be positive";
  return errors;
}

// ── Placeholders ────────────────────────────────────────────────

export interface CorrelatedExposureCheck {
  evaluate(
    positions: readonly OpenPosition[],
    newTrade: TradeInputs,
  ): RiskWarning | null;
}

export const noopCorrelatedExposureCheck: CorrelatedExposureCheck = {
  evaluate() {
    return null;
  },
};

export interface PropFirmRules {
  maxDailyLossUSD: number;
  maxTotalLossUSD: number;
  maxLotSize?: number;
  minTradingDays?: number;
}

export interface PropFirmCheckResult {
  passed: boolean;
  warnings: RiskWarning[];
}

export function evaluatePropFirmRules(
  rules: PropFirmRules | null,
  _state: { dailyLossUSD: number; totalLossUSD: number; lotSize: number },
): PropFirmCheckResult {
  if (rules == null) return { passed: true, warnings: [] };
  return { passed: true, warnings: [] };
}

// ── Single entry point ──────────────────────────────────────────

export function evaluateTrade(args: {
  account: AccountState;
  profile: RiskProfile;
  trade: TradeInputs;
  daily: DailyState;
  correlated?: CorrelatedExposureCheck;
  propFirm?: PropFirmRules | null;
}): RiskEvaluation {
  const {
    account,
    profile,
    trade,
    daily,
    correlated = noopCorrelatedExposureCheck,
    propFirm = null,
  } = args;

  const validationErrors = validateTradeInputs(account, trade, profile);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const riskAmountUSD = calculateRiskAmount(
    account,
    profile,
    trade.riskMode,
    trade.fixedRiskAmount,
  );
  const pipDistance = calculatePipDistance(trade.pair, trade.entry, trade.stopLoss);
  const rawLotSize = calculateLotSize(riskAmountUSD, pipDistance, trade.pipValueUSD);
  const lotSize = applyConservativeMode(rawLotSize, profile.conservativeMode);
  const exposureUnits = calculateExposureUnits(lotSize);

  const totalOpenRiskUSDAfterTrade = daily.openRiskUSD + riskAmountUSD;
  const totalOpenRiskPctAfterTrade =
    account.balance > 0
      ? (totalOpenRiskUSDAfterTrade / account.balance) * 100
      : 0;
  const dailyLossPct =
    account.balance > 0 ? (daily.realizedLossUSD / account.balance) * 100 : 0;

  const warnings: RiskWarning[] = [];

  if (hasValidationErrors) {
    for (const [field, msg] of Object.entries(validationErrors)) {
      warnings.push({
        level: "block",
        code: "validation_error",
        message: `${field}: ${msg}`,
      });
    }
  }

  if (totalOpenRiskPctAfterTrade > RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT) {
    warnings.push({
      level: "block",
      code: "exceeds_safety_threshold",
      message: `Total open risk would be ${totalOpenRiskPctAfterTrade.toFixed(1)}% of balance — exceeds the ${RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT}% safety threshold.`,
    });
  } else if (totalOpenRiskPctAfterTrade > RISK_THRESHOLDS.DAILY_LOSS_GUIDELINE_PCT) {
    warnings.push({
      level: "warn",
      code: "exceeds_daily_loss_guideline",
      message: `Total open risk is ${totalOpenRiskPctAfterTrade.toFixed(1)}% of balance — approaching the ${RISK_THRESHOLDS.DAILY_LOSS_GUIDELINE_PCT}% daily loss guideline.`,
    });
  }

  if (totalOpenRiskPctAfterTrade > profile.maxTotalOpenRiskPct) {
    warnings.push({
      level: "block",
      code: "exceeds_total_open_risk_profile",
      message: `Total open risk ${totalOpenRiskPctAfterTrade.toFixed(1)}% exceeds your profile cap of ${profile.maxTotalOpenRiskPct}%.`,
    });
  }

  if (dailyLossPct > profile.maxDailyLossPct) {
    warnings.push({
      level: "block",
      code: "exceeds_daily_loss_profile",
      message: `Daily realized loss ${dailyLossPct.toFixed(1)}% exceeds your profile cap of ${profile.maxDailyLossPct}%.`,
    });
  }

  if (profile.conservativeMode) {
    warnings.push({
      level: "info",
      code: "conservative_mode_active",
      message:
        "Conservative mode is ON — lot size is halved. Recommended for beginners to reduce emotional pressure and protect capital during the learning curve.",
    });
  }

  const correlatedWarning = correlated.evaluate([], trade);
  if (correlatedWarning) warnings.push(correlatedWarning);

  const propFirmResult = evaluatePropFirmRules(propFirm, {
    dailyLossUSD: daily.realizedLossUSD,
    totalLossUSD: daily.realizedLossUSD,
    lotSize,
  });
  warnings.push(...propFirmResult.warnings);

  const blocked = warnings.some((w) => w.level === "block");

  return {
    riskAmountUSD,
    pipDistance,
    rawLotSize,
    lotSize,
    exposureUnits,
    totalOpenRiskUSDAfterTrade,
    totalOpenRiskPctAfterTrade,
    dailyLossPct,
    blocked,
    warnings,
    validationErrors,
  };
}
