// src/components/chart/overlays.ts
// Pure functions that build overlay configurations from domain data.
// No React or chart API calls — data transformation only.

import { LineStyle } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import { CHART_COLORS } from "@/lib/chart-colors";
import type { PairAnalysis, MarketData, OHLCVCandle } from "@/types/trading";

// ── Types ───────────────────────────────────────────────────────

export interface PriceLineConfig {
  price: number;
  color: string;
  title: string;
  lineWidth: number;
  lineStyle: LineStyle;
  axisLabelVisible: boolean;
}

export interface ChartMarker {
  time: UTCTimestamp;
  position: "belowBar" | "aboveBar";
  shape: "arrowUp" | "arrowDown";
  color: string;
  text: string;
}

// ── Analysis price lines (entry zone, SL, TP1-3) ───────────────

export function buildAnalysisPriceLines(
  analysis: PairAnalysis | null,
): PriceLineConfig[] {
  if (!analysis || analysis.verdict === "no_trade") return [];

  return [
    // Entry zone — two dashed blue lines
    {
      price: analysis.entryZone[0],
      color: CHART_COLORS.entryLine,
      title: "Entry Lo",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    },
    {
      price: analysis.entryZone[1],
      color: CHART_COLORS.entryLine,
      title: "Entry Hi",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    },
    // Stop Loss — solid red
    {
      price: analysis.stopLoss,
      color: CHART_COLORS.stopLoss,
      title: "SL",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
    },
    // Take Profits — solid/dashed green
    {
      price: analysis.tp1,
      color: CHART_COLORS.takeProfit,
      title: "TP1",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
    },
    {
      price: analysis.tp2,
      color: CHART_COLORS.takeProfit,
      title: "TP2",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    },
    {
      price: analysis.tp3,
      color: CHART_COLORS.takeProfit,
      title: "TP3",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
    },
  ];
}

// ── Market data price lines (support, resistance) ───────────────

export function buildMarketDataPriceLines(
  md: MarketData | null,
): PriceLineConfig[] {
  if (!md) return [];

  const lines: PriceLineConfig[] = [];

  if (md.supportLevel > 0) {
    lines.push({
      price: md.supportLevel,
      color: CHART_COLORS.support,
      title: "Support",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
  }

  if (md.resistanceLevel > 0) {
    lines.push({
      price: md.resistanceLevel,
      color: CHART_COLORS.resistance,
      title: "Resistance",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
  }

  return lines;
}

// ── Signal markers (arrows on candles) ──────────────────────────

/**
 * Build markers for active signals. Places an arrow on the candle
 * closest to the signal's entry price timestamp. If no close match
 * is found, uses the most recent candle.
 */
export function buildSignalMarkers(
  signals: Array<{
    id: string;
    direction: string | null;
    entry_price: number | string | null;
    created_at: string;
  }>,
  candles: OHLCVCandle[],
): ChartMarker[] {
  if (!signals.length || !candles.length) return [];

  return signals
    .filter((s) => s.entry_price != null && s.direction != null)
    .map((s) => {
      const isLong = s.direction === "long";

      // Find the candle closest in time to the signal's created_at
      const signalTime = new Date(s.created_at).getTime();
      let closestIdx = candles.length - 1;
      let closestDiff = Infinity;

      for (let i = 0; i < candles.length; i++) {
        const diff = Math.abs(new Date(candles[i].candle_time).getTime() - signalTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
      }

      return {
        time: Math.floor(new Date(candles[closestIdx].candle_time).getTime() / 1000) as UTCTimestamp,
        position: isLong ? "belowBar" as const : "aboveBar" as const,
        shape: isLong ? "arrowUp" as const : "arrowDown" as const,
        color: isLong ? CHART_COLORS.bullish : CHART_COLORS.bearish,
        text: `${isLong ? "Long" : "Short"} @ ${Number(s.entry_price).toFixed(4)}`,
      };
    });
}
