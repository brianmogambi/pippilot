// Deterministic signal generation engine.
// No AI/LLM — all logic is rule-based and reproducible.

import { ema, rsi, atr, macd, bollingerBands, lastValid, sma } from "./indicators.ts";
import type { ExplanationResult } from "./explanation-service.ts";

// ── Types ──────────────────────────────────────────────────────

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  datetime: string;
}

export interface TimeframeData {
  h1: OHLCV[];
  h4: OHLCV[];
  d1: OHLCV[];
}

export interface TimeframeIndicators {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  macdHist: number;
  bbUpper: number;
  bbLower: number;
  bbWidth: number;
  trend: "bullish" | "bearish" | "neutral";
  price: number;
}

export type SetupType =
  | "trend_pullback"
  | "breakout_retest"
  | "range_reversal"
  | "momentum_breakout"
  | "sr_rejection";

export interface SetupResult {
  type: SetupType;
  direction: "long" | "short";
  timeframe: string;
  strength: number; // 0-1
}

export interface SignalOutput {
  pair: string;
  direction: "long" | "short";
  timeframe: string;
  entryPrice: number;
  entryZone: [number, number];
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confidence: number;
  setupType: string;
  setupQuality: "A+" | "A" | "B" | "C";
  verdict: "trade" | "no_trade";
  noTradeReason: string | null;
  invalidation: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  beginnerExplanation: string;
  expertExplanation: string;
  trendH1: "bullish" | "bearish" | "neutral";
  trendH4: "bullish" | "bearish" | "neutral";
  trendD1: "bullish" | "bearish" | "neutral";
  marketStructure: "trending" | "ranging" | "breakout";
  supportLevel: number;
  resistanceLevel: number;
  riskReward: number;
  // Phase 8: optional metadata slot populated by the runner after the
  // explanation service runs. The signal engine itself does not use it.
  explanationMeta?: ExplanationResult;
}

// ── Indicator computation ──────────────────────────────────────

export function computeIndicators(candles: OHLCV[]): TimeframeIndicators {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const price = closes[closes.length - 1];

  const ema20 = lastValid(ema(closes, 20));
  const ema50 = lastValid(ema(closes, 50));
  const ema200 = closes.length >= 200 ? lastValid(ema(closes, 200)) : ema50;
  const rsi14 = lastValid(rsi(closes, 14));
  const atr14 = lastValid(atr(highs, lows, closes, 14));
  const macdResult = macd(closes, 12, 26, 9);
  const macdHist = lastValid(macdResult.histogram);
  const bb = bollingerBands(closes, 20, 2);
  const bbUpper = lastValid(bb.upper);
  const bbLower = lastValid(bb.lower);
  const bbMiddle = lastValid(bb.middle);
  const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;

  const trend = detectTrend(ema20, ema50, ema200, price);

  return { ema20, ema50, ema200, rsi14, atr14, macdHist, bbUpper, bbLower, bbWidth, trend, price };
}

// ── Trend detection ────────────────────────────────────────────

export function detectTrend(
  ema20: number,
  ema50: number,
  ema200: number,
  price: number,
): "bullish" | "bearish" | "neutral" {
  if (isNaN(ema20) || isNaN(ema50)) return "neutral";

  const bullishCount =
    (price > ema20 ? 1 : 0) +
    (price > ema50 ? 1 : 0) +
    (ema20 > ema50 ? 1 : 0) +
    (!isNaN(ema200) && price > ema200 ? 1 : 0) +
    (!isNaN(ema200) && ema50 > ema200 ? 1 : 0);

  const maxScore = isNaN(ema200) ? 3 : 5;
  const ratio = bullishCount / maxScore;

  if (ratio >= 0.7) return "bullish";
  if (ratio <= 0.3) return "bearish";
  return "neutral";
}

// ── Market structure ───────────────────────────────────────────

export function classifyStructure(
  h4: TimeframeIndicators,
  d1: TimeframeIndicators,
): "trending" | "ranging" | "breakout" {
  // Breakout: price outside Bollinger Bands + high ATR
  if (h4.price > h4.bbUpper || h4.price < h4.bbLower) {
    if (h4.bbWidth > 0.02) return "breakout";
  }

  // Trending: strong EMA alignment + reasonable ATR
  if (h4.trend !== "neutral" && d1.trend !== "neutral" && h4.trend === d1.trend) {
    return "trending";
  }

  // Default: ranging
  return "ranging";
}

// ── Support / Resistance detection ─────────────────────────────

function findSupportResistance(candles: OHLCV[]): { support: number; resistance: number } {
  if (candles.length < 20) {
    return { support: candles[candles.length - 1]?.low ?? 0, resistance: candles[candles.length - 1]?.high ?? 0 };
  }

  const recent = candles.slice(-20);
  const lows = recent.map((c) => c.low).sort((a, b) => a - b);
  const highs = recent.map((c) => c.high).sort((a, b) => b - a);

  // Use the 2nd and 3rd lowest/highest as more reliable levels
  const support = (lows[1] + lows[2]) / 2;
  const resistance = (highs[1] + highs[2]) / 2;

  return { support, resistance };
}

// ── Setup detection ────────────────────────────────────────────

export function detectSetups(
  h1: TimeframeIndicators,
  h4: TimeframeIndicators,
  d1: TimeframeIndicators,
  h1Candles: OHLCV[],
): SetupResult[] {
  const setups: SetupResult[] = [];

  // 1. Trend Pullback: H4/D1 trending + H1 pulling back to EMA + RSI mid-range
  if (h4.trend === "bullish" && d1.trend !== "bearish") {
    const nearEma = Math.abs(h1.price - h1.ema20) / h1.atr14;
    if (nearEma < 1.5 && h1.rsi14 >= 35 && h1.rsi14 <= 65) {
      setups.push({ type: "trend_pullback", direction: "long", timeframe: "H4", strength: 0.8 });
    }
  }
  if (h4.trend === "bearish" && d1.trend !== "bullish") {
    const nearEma = Math.abs(h1.price - h1.ema20) / h1.atr14;
    if (nearEma < 1.5 && h1.rsi14 >= 35 && h1.rsi14 <= 65) {
      setups.push({ type: "trend_pullback", direction: "short", timeframe: "H4", strength: 0.8 });
    }
  }

  // 2. Breakout Retest: price broke above/below recent range and is retesting
  if (h1Candles.length >= 20) {
    const prev20High = Math.max(...h1Candles.slice(-25, -5).map((c) => c.high));
    const prev20Low = Math.min(...h1Candles.slice(-25, -5).map((c) => c.low));

    // Bullish breakout retest
    if (h1.price > prev20High && h1.price < prev20High + h1.atr14 * 2) {
      setups.push({ type: "breakout_retest", direction: "long", timeframe: "H1", strength: 0.7 });
    }
    // Bearish breakout retest
    if (h1.price < prev20Low && h1.price > prev20Low - h1.atr14 * 2) {
      setups.push({ type: "breakout_retest", direction: "short", timeframe: "H1", strength: 0.7 });
    }
  }

  // 3. Range Reversal: ranging structure + RSI extreme + at boundary
  if (h4.bbWidth < 0.015) {
    if (h1.rsi14 <= 30 && h1.price <= h1.bbLower + h1.atr14 * 0.5) {
      setups.push({ type: "range_reversal", direction: "long", timeframe: "H1", strength: 0.6 });
    }
    if (h1.rsi14 >= 70 && h1.price >= h1.bbUpper - h1.atr14 * 0.5) {
      setups.push({ type: "range_reversal", direction: "short", timeframe: "H1", strength: 0.6 });
    }
  }

  // 4. Momentum Breakout: strong candle + ATR spike + EMA alignment
  if (h1Candles.length >= 5) {
    const last = h1Candles[h1Candles.length - 1];
    const bodySize = Math.abs(last.close - last.open);
    if (bodySize > h1.atr14 * 1.5 && h1.trend !== "neutral") {
      const dir = last.close > last.open ? "long" as const : "short" as const;
      if ((dir === "long" && h1.trend === "bullish") || (dir === "short" && h1.trend === "bearish")) {
        setups.push({ type: "momentum_breakout", direction: dir, timeframe: "H1", strength: 0.65 });
      }
    }
  }

  // 5. S/R Rejection: at key level with rejection wick
  if (h1Candles.length >= 3) {
    const last = h1Candles[h1Candles.length - 1];
    const body = Math.abs(last.close - last.open);
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;

    // Bullish rejection (long lower wick at support)
    if (lowerWick > body * 2 && lowerWick > h1.atr14 * 0.5) {
      setups.push({ type: "sr_rejection", direction: "long", timeframe: "H1", strength: 0.55 });
    }
    // Bearish rejection (long upper wick at resistance)
    if (upperWick > body * 2 && upperWick > h1.atr14 * 0.5) {
      setups.push({ type: "sr_rejection", direction: "short", timeframe: "H1", strength: 0.55 });
    }
  }

  // Sort by strength descending
  return setups.sort((a, b) => b.strength - a.strength);
}

// ── Confluence scoring ─────────────────────────────────────────

interface ConfluenceFactors {
  trendH1: "bullish" | "bearish" | "neutral";
  trendH4: "bullish" | "bearish" | "neutral";
  trendD1: "bullish" | "bearish" | "neutral";
  direction: "long" | "short";
  structure: "trending" | "ranging" | "breakout";
  setupType: SetupType;
  rsi: number;
  macdHist: number;
  emaAligned: boolean;
  nearKeyLevel: boolean;
  setupStrength: number;
  isSessionActive: boolean;
  isOverextended: boolean;
}

export function scoreConfluence(f: ConfluenceFactors): number {
  let score = 50;

  // Timeframe alignment
  const expectedTrend = f.direction === "long" ? "bullish" : "bearish";
  const alignments = [f.trendH1, f.trendH4, f.trendD1].filter((t) => t === expectedTrend).length;
  if (alignments === 3) score += 15;
  else if (alignments === 2) score += 8;
  else if (alignments === 0) score -= 10;

  // Market structure match
  if (f.structure === "trending" && (f.setupType === "trend_pullback" || f.setupType === "momentum_breakout")) score += 10;
  if (f.structure === "ranging" && f.setupType === "range_reversal") score += 10;
  if (f.structure === "breakout" && (f.setupType === "breakout_retest" || f.setupType === "momentum_breakout")) score += 10;

  // EMA alignment
  if (f.emaAligned) score += 5;

  // RSI confirmation
  if (f.direction === "long" && f.rsi >= 40 && f.rsi <= 60) score += 5;
  if (f.direction === "short" && f.rsi >= 40 && f.rsi <= 60) score += 5;
  if (f.direction === "long" && f.rsi < 30) score += 3; // oversold bounce
  if (f.direction === "short" && f.rsi > 70) score += 3; // overbought rejection

  // MACD confirmation
  if ((f.direction === "long" && f.macdHist > 0) || (f.direction === "short" && f.macdHist < 0)) {
    score += 5;
  }

  // Near key level
  if (f.nearKeyLevel) score += 5;

  // Setup pattern strength
  score += Math.round(f.setupStrength * 5);

  // Session timing
  if (f.isSessionActive) score += 3;

  // Penalties
  if (f.isOverextended) score -= 8;
  // Trend conflict: direction opposes majority trend
  const opposites = [f.trendH1, f.trendH4, f.trendD1].filter(
    (t) => t === (f.direction === "long" ? "bearish" : "bullish"),
  ).length;
  if (opposites >= 2) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ── Quality grading ────────────────────────────────────────────

export function gradeQuality(confidence: number): "A+" | "A" | "B" | "C" {
  if (confidence >= 80) return "A+";
  if (confidence >= 65) return "A";
  if (confidence >= 50) return "B";
  return "C";
}

// ── Verdict ────────────────────────────────────────────────────

export function determineVerdict(
  confidence: number,
  alignments: number,
  riskReward: number,
): { verdict: "trade" | "no_trade"; reason: string | null } {
  if (confidence < 45) return { verdict: "no_trade", reason: "Confidence too low" };
  if (alignments === 0) return { verdict: "no_trade", reason: "No timeframe alignment" };
  if (riskReward < 1.2) return { verdict: "no_trade", reason: "Risk/reward ratio below 1.2" };
  return { verdict: "trade", reason: null };
}

// ── Level computation ──────────────────────────────────────────

function computeLevels(
  setup: SetupResult,
  h1: TimeframeIndicators,
  h4: TimeframeIndicators,
  h1Candles: OHLCV[],
  pair: string,
): { entry: number; entryZone: [number, number]; sl: number; tp1: number; tp2: number; tp3: number } {
  const price = h1.price;
  const atrBuf = h1.atr14;
  const isJpy = pair.includes("JPY");
  const isGold = pair === "XAU/USD";
  const roundTo = isGold ? 2 : isJpy ? 3 : 5;

  const round = (n: number) => +n.toFixed(roundTo);

  let entry: number;
  let sl: number;

  if (setup.direction === "long") {
    entry = price;
    sl = round(price - atrBuf * 1.5);

    // Use EMA as entry zone for pullbacks
    if (setup.type === "trend_pullback") {
      entry = round(Math.min(price, h1.ema20));
      sl = round(Math.min(entry, h1.ema50) - atrBuf);
    }
  } else {
    entry = price;
    sl = round(price + atrBuf * 1.5);

    if (setup.type === "trend_pullback") {
      entry = round(Math.max(price, h1.ema20));
      sl = round(Math.max(entry, h1.ema50) + atrBuf);
    }
  }

  const risk = Math.abs(entry - sl);
  const tp1 = round(setup.direction === "long" ? entry + risk * 1.5 : entry - risk * 1.5);
  const tp2 = round(setup.direction === "long" ? entry + risk * 2.5 : entry - risk * 2.5);
  const tp3 = round(setup.direction === "long" ? entry + risk * 4 : entry - risk * 4);

  const zoneSpread = atrBuf * 0.3;
  const entryZone: [number, number] = [round(entry - zoneSpread), round(entry + zoneSpread)];

  return { entry: round(entry), entryZone, sl, tp1, tp2, tp3 };
}

// ── Template-based explanations ────────────────────────────────

const SETUP_NAMES: Record<SetupType, string> = {
  trend_pullback: "Trend Pullback",
  breakout_retest: "Breakout Retest",
  range_reversal: "Range Reversal",
  momentum_breakout: "Momentum Breakout",
  sr_rejection: "S/R Rejection",
};

export function generateExplanations(
  pair: string,
  setup: SetupResult,
  h1: TimeframeIndicators,
  h4: TimeframeIndicators,
  d1: TimeframeIndicators,
  confidence: number,
): { beginner: string; expert: string } {
  const setupName = SETUP_NAMES[setup.type];
  const dirWord = setup.direction === "long" ? "bullish" : "bearish";
  const action = setup.direction === "long" ? "buy" : "sell";

  const beginner = `${pair} is showing a ${setupName} pattern. ` +
    `The overall trend is ${dirWord} across multiple timeframes, suggesting a potential ${action} opportunity. ` +
    `The price has ${setup.type === "trend_pullback" ? "pulled back to a support area where buyers may step in" :
      setup.type === "breakout_retest" ? "broken through a key level and is retesting it" :
      setup.type === "range_reversal" ? "reached the edge of its recent range where it may reverse" :
      setup.type === "momentum_breakout" ? "made a strong move showing increased momentum" :
      "been rejected at a key support/resistance level"}. ` +
    `Confidence for this setup is ${confidence}%.`;

  const expert = `${setupName} on ${setup.timeframe}. ` +
    `EMA stack: price ${h1.price > h1.ema20 ? ">" : "<"} EMA20 (${h1.ema20.toFixed(4)}) ${h1.ema20 > h1.ema50 ? ">" : "<"} EMA50 (${h1.ema50.toFixed(4)}). ` +
    `RSI(14): ${h1.rsi14.toFixed(1)}. MACD hist: ${h1.macdHist > 0 ? "positive" : "negative"}. ` +
    `ATR(14): ${h1.atr14.toFixed(pair.includes("JPY") ? 3 : 5)}. ` +
    `H4 trend: ${h4.trend}, D1 trend: ${d1.trend}. ` +
    `BB width: ${(h4.bbWidth * 100).toFixed(1)}% — structure: ${h4.trend === d1.trend && h4.trend !== "neutral" ? "trending" : h4.bbWidth < 0.015 ? "ranging" : "mixed"}. ` +
    `Confluence: ${confidence}/100.`;

  return { beginner, expert };
}

// ── Reasons for/against ────────────────────────────────────────

export function generateReasons(
  setup: SetupResult,
  h1: TimeframeIndicators,
  h4: TimeframeIndicators,
  d1: TimeframeIndicators,
  structure: "trending" | "ranging" | "breakout",
): { reasonsFor: string[]; reasonsAgainst: string[] } {
  const expectedTrend = setup.direction === "long" ? "bullish" : "bearish";
  const oppositeTrend = setup.direction === "long" ? "bearish" : "bullish";
  const reasonsFor: string[] = [];
  const reasonsAgainst: string[] = [];

  // For
  if (h4.trend === expectedTrend) reasonsFor.push(`H4 trend is ${expectedTrend}`);
  if (d1.trend === expectedTrend) reasonsFor.push(`D1 trend confirms ${expectedTrend} bias`);
  if (h1.trend === expectedTrend) reasonsFor.push(`H1 aligned with higher timeframes`);

  if (setup.direction === "long" && h1.rsi14 < 40) reasonsFor.push(`RSI at ${h1.rsi14.toFixed(0)} — near oversold`);
  if (setup.direction === "short" && h1.rsi14 > 60) reasonsFor.push(`RSI at ${h1.rsi14.toFixed(0)} — near overbought`);

  if ((setup.direction === "long" && h1.macdHist > 0) || (setup.direction === "short" && h1.macdHist < 0)) {
    reasonsFor.push("MACD histogram confirms direction");
  }

  if (structure === "trending" && setup.type === "trend_pullback") reasonsFor.push("Trading with the trend (pullback entry)");
  if (structure === "ranging" && setup.type === "range_reversal") reasonsFor.push("Range boundary reversal pattern");
  if (setup.type === "breakout_retest") reasonsFor.push("Breakout level being retested as support/resistance");

  // Against
  if (h4.trend === oppositeTrend) reasonsAgainst.push(`H4 trend opposes signal direction`);
  if (d1.trend === oppositeTrend) reasonsAgainst.push(`D1 trend is ${oppositeTrend} — counter-trend trade`);
  if (h1.trend === "neutral") reasonsAgainst.push("H1 trend is unclear (neutral)");

  if (setup.direction === "long" && h1.rsi14 > 70) reasonsAgainst.push(`RSI at ${h1.rsi14.toFixed(0)} — overbought risk`);
  if (setup.direction === "short" && h1.rsi14 < 30) reasonsAgainst.push(`RSI at ${h1.rsi14.toFixed(0)} — oversold risk`);

  if (h4.bbWidth < 0.008) reasonsAgainst.push("Very low volatility — may lack follow-through");
  if (h4.bbWidth > 0.04) reasonsAgainst.push("High volatility — increased risk of whipsaw");

  // Ensure at least one reason each
  if (reasonsFor.length === 0) reasonsFor.push("Setup pattern detected on timeframe");
  if (reasonsAgainst.length === 0) reasonsAgainst.push("No significant counter-signals identified");

  return { reasonsFor, reasonsAgainst };
}

// ── Main analysis function ─────────────────────────────────────

export function analyzeForSignal(
  pair: string,
  data: TimeframeData,
  isSessionActive: boolean,
): SignalOutput | null {
  if (data.h1.length < 50 || data.h4.length < 30 || data.d1.length < 20) {
    console.warn(`Insufficient data for ${pair}: H1=${data.h1.length}, H4=${data.h4.length}, D1=${data.d1.length}`);
    return null;
  }

  const h1 = computeIndicators(data.h1);
  const h4 = computeIndicators(data.h4);
  const d1 = computeIndicators(data.d1);

  const structure = classifyStructure(h4, d1);
  const setups = detectSetups(h1, h4, d1, data.h1);

  if (setups.length === 0) return null;

  const bestSetup = setups[0];
  const { support, resistance } = findSupportResistance(data.h4);

  // Check if price is near a key level
  const distToSupport = Math.abs(h1.price - support) / h1.atr14;
  const distToResistance = Math.abs(h1.price - resistance) / h1.atr14;
  const nearKeyLevel = distToSupport < 2 || distToResistance < 2;

  // Check overextension
  const isOverextended =
    (bestSetup.direction === "long" && h1.rsi14 > 75) ||
    (bestSetup.direction === "short" && h1.rsi14 < 25);

  // EMA alignment check
  const emaAligned = bestSetup.direction === "long"
    ? h1.price > h1.ema20 && h1.ema20 > h1.ema50
    : h1.price < h1.ema20 && h1.ema20 < h1.ema50;

  const confidence = scoreConfluence({
    trendH1: h1.trend,
    trendH4: h4.trend,
    trendD1: d1.trend,
    direction: bestSetup.direction,
    structure,
    setupType: bestSetup.type,
    rsi: h1.rsi14,
    macdHist: h1.macdHist,
    emaAligned,
    nearKeyLevel,
    setupStrength: bestSetup.strength,
    isSessionActive,
    isOverextended,
  });

  const levels = computeLevels(bestSetup, h1, h4, data.h1, pair);
  const riskReward = Math.abs(levels.tp1 - levels.entry) / Math.abs(levels.entry - levels.sl);

  const expectedTrend = bestSetup.direction === "long" ? "bullish" : "bearish";
  const alignments = [h1.trend, h4.trend, d1.trend].filter((t) => t === expectedTrend).length;

  const { verdict, reason: noTradeReason } = determineVerdict(confidence, alignments, riskReward);
  const quality = gradeQuality(confidence);
  const { beginner, expert } = generateExplanations(pair, bestSetup, h1, h4, d1, confidence);
  const { reasonsFor, reasonsAgainst } = generateReasons(bestSetup, h1, h4, d1, structure);

  const invalidation = bestSetup.direction === "long"
    ? `Setup invalidated if price closes below ${levels.sl.toFixed(pair.includes("JPY") ? 3 : 5)}`
    : `Setup invalidated if price closes above ${levels.sl.toFixed(pair.includes("JPY") ? 3 : 5)}`;

  return {
    pair,
    direction: bestSetup.direction,
    timeframe: bestSetup.timeframe,
    entryPrice: levels.entry,
    entryZone: levels.entryZone,
    stopLoss: levels.sl,
    tp1: levels.tp1,
    tp2: levels.tp2,
    tp3: levels.tp3,
    confidence,
    setupType: SETUP_NAMES[bestSetup.type],
    setupQuality: quality,
    verdict,
    noTradeReason,
    invalidation,
    reasonsFor,
    reasonsAgainst,
    beginnerExplanation: beginner,
    expertExplanation: expert,
    trendH1: h1.trend,
    trendH4: h4.trend,
    trendD1: d1.trend,
    marketStructure: structure,
    supportLevel: support,
    resistanceLevel: resistance,
    riskReward: Math.round(riskReward * 100) / 100,
  };
}
