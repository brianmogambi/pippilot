// src/components/chart/CandlestickChart.tsx
// React wrapper for TradingView Lightweight Charts v5.
// Owns the imperative chart lifecycle; overlay logic lives in overlays.ts.

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
} from "lightweight-charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BarChart3 } from "lucide-react";
import { CHART_COLORS } from "@/lib/chart-colors";
import { calculateEMA } from "@/lib/indicators";
import {
  buildAnalysisPriceLines,
  buildMarketDataPriceLines,
  buildSignalMarkers,
} from "./overlays";
import type { OHLCVCandle, PairAnalysis, MarketData, Verdict } from "@/types/trading";

// ── Props ───────────────────────────────────────────────────────

export interface ChartSetupLabel {
  setupType: string;
  direction: "long" | "short";
  confidence: number;
  verdict: Verdict;
}

interface CandlestickChartProps {
  candles: OHLCVCandle[];
  analysis: PairAnalysis | null;
  marketData: MarketData | null;
  signals: Array<{
    id: string;
    direction: string | null;
    entry_price: number | string | null;
    created_at: string;
  }>;
  isLoading: boolean;
  isFetching: boolean;
  setupLabel?: ChartSetupLabel | null;
}

// ── Helpers ─────────────────────────────────────────────────────

function toUTC(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

/** Deduplicate candles by time (keep last occurrence) */
function dedupeByTime(candles: OHLCVCandle[]): OHLCVCandle[] {
  const seen = new Map<number, OHLCVCandle>();
  for (const c of candles) {
    seen.set(toUTC(c.candle_time), c);
  }
  return Array.from(seen.values()).sort(
    (a, b) => toUTC(a.candle_time) - toUTC(b.candle_time),
  );
}

function candlesToChartData(candles: OHLCVCandle[]): CandlestickData<UTCTimestamp>[] {
  return candles.map((c) => ({
    time: toUTC(c.candle_time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function emaToLineData(
  ema: Array<{ time: string; value: number }>,
): LineData<UTCTimestamp>[] {
  return ema.map((e) => ({
    time: toUTC(e.time),
    value: e.value,
  }));
}

// ── Component ───────────────────────────────────────────────────

export default function CandlestickChart({
  candles,
  analysis,
  marketData,
  signals,
  isLoading,
  isFetching,
  setupLabel = null,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersPluginRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null);
  const initialFitDone = useRef(false);

  // ── Effect 1: Create / destroy chart ────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: CHART_COLORS.crosshair },
        horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: CHART_COLORS.crosshair },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.bullish,
      downColor: CHART_COLORS.bearish,
      borderUpColor: CHART_COLORS.bullish,
      borderDownColor: CHART_COLORS.bearish,
      wickUpColor: CHART_COLORS.bullish,
      wickDownColor: CHART_COLORS.bearish,
    });
    candleSeriesRef.current = candleSeries;

    // EMA line series
    ema20Ref.current = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema200,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.resize(width, height);
        }
      }
    });
    ro.observe(el);

    initialFitDone.current = false;

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      priceLinesRef.current = [];
      markersPluginRef.current = null;
    };
  }, []); // mount/unmount only

  // ── Effect 2: Set candle + EMA data ─────────────────────────

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !chart || candles.length === 0) return;

    const deduped = dedupeByTime(candles);
    const chartData = candlesToChartData(deduped);
    candleSeries.setData(chartData);

    // EMA overlays
    const ema20Data = emaToLineData(calculateEMA(deduped, 20));
    const ema50Data = emaToLineData(calculateEMA(deduped, 50));
    const ema200Data = emaToLineData(calculateEMA(deduped, 200));

    ema20Ref.current?.setData(ema20Data);
    ema50Ref.current?.setData(ema50Data);
    ema200Ref.current?.setData(ema200Data);

    // Fit content on first data load only
    if (!initialFitDone.current) {
      chart.timeScale().fitContent();
      initialFitDone.current = true;
    }
  }, [candles]);

  // ── Effect 3: Price lines + signal markers ──────────────────

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    // Remove old price lines
    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    priceLinesRef.current = [];

    // Build and apply new price lines
    const configs = [
      ...buildAnalysisPriceLines(analysis),
      ...buildMarketDataPriceLines(marketData),
    ];

    for (const cfg of configs) {
      const line = candleSeries.createPriceLine({
        price: cfg.price,
        color: cfg.color,
        title: cfg.title,
        lineWidth: cfg.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: cfg.lineStyle,
        axisLabelVisible: cfg.axisLabelVisible,
      });
      priceLinesRef.current.push(line);
    }

    // Signal markers
    if (candles.length > 0) {
      const markers = buildSignalMarkers(signals, candles);
      // Sort markers by time (required by lightweight-charts)
      markers.sort((a, b) => (a.time as number) - (b.time as number));

      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers(markers);
      } else if (markers.length > 0) {
        markersPluginRef.current = createSeriesMarkers(candleSeries, markers);
      }
    }
  }, [analysis, marketData, signals, candles]);

  // ── Loading state ─────────────────────────────────────────────

  if (isLoading && candles.length === 0) {
    return <Skeleton className="h-[400px] lg:h-[500px] w-full rounded-b-lg" />;
  }

  if (!isLoading && candles.length === 0) {
    return (
      <div className="h-[400px] lg:h-[500px] flex flex-col items-center justify-center bg-muted/10 rounded-b-lg">
        <BarChart3 className="h-10 w-10 text-muted-foreground/20 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">
          No candle data available
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Data will appear once the market data sync completes
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[400px] lg:h-[500px] w-full rounded-b-lg overflow-hidden"
      />

      {/* Fetching overlay */}
      {isFetching && candles.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border px-2 py-1">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[10px] text-muted-foreground">Updating...</span>
        </div>
      )}

      {/* EMA legend */}
      <div className="absolute top-2 left-2 flex items-center gap-3 text-[10px] font-mono">
        <span style={{ color: CHART_COLORS.ema20 }}>EMA 20</span>
        <span style={{ color: CHART_COLORS.ema50 }}>EMA 50</span>
        <span style={{ color: CHART_COLORS.ema200 }}>EMA 200</span>
      </div>

      {/* Active setup label — single source: the active enriched signal */}
      {setupLabel && (
        <div
          className={`absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md backdrop-blur-sm border px-2 py-1 text-[10px] font-medium ${
            setupLabel.verdict === "no_trade"
              ? "bg-warning/10 border-warning/30 text-warning opacity-80"
              : setupLabel.direction === "long"
                ? "bg-bullish/10 border-bullish/30 text-bullish"
                : "bg-bearish/10 border-bearish/30 text-bearish"
          }`}
        >
          <span className="uppercase tracking-wider">{setupLabel.direction}</span>
          <span className="text-foreground/80">·</span>
          <span className="text-foreground">{setupLabel.setupType}</span>
          <span className="text-foreground/80">·</span>
          <span className="font-mono">{setupLabel.confidence}%</span>
          <span className="text-foreground/80">·</span>
          <span className="uppercase">{setupLabel.verdict === "no_trade" ? "no trade" : "trade"}</span>
        </div>
      )}
    </div>
  );
}
