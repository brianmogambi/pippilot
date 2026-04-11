# Real Charts Implementation — Phase 4

> Implemented 2026-04-11. Replaces the chart placeholder on PairDetail.tsx with a real candlestick chart powered by TradingView Lightweight Charts v5, fed from persisted OHLCV data, with EMA overlays and signal annotations.

## Architecture

```
PairDetail.tsx
  │
  ├─ useCandlesWithFetch(pair, dbTimeframe, 300)   ─── Phase 3 data layer
  ├─ usePairAnalysis(pair) ─────────────────────────── PairAnalysis | null
  ├─ useMarketData(pair)   ─────────────────────────── MarketData | null
  ├─ useSignalsByPair(pair) ────────────────────────── Signal[]
  │
  └─ <CandlestickChart …>
        │
        ├─ createChart() (lightweight-charts v5, imperative)
        │
        ├─ candleSeries.setData(candles → UTCTimestamp)
        │
        ├─ calculateEMA(20/50/200) → lineSeries.setData()
        │
        ├─ buildAnalysisPriceLines(analysis)   → series.createPriceLine()
        ├─ buildMarketDataPriceLines(md)        → series.createPriceLine()
        └─ buildSignalMarkers(signals, candles) → createSeriesMarkers()
```

## Component decomposition

| Layer | File | Responsibility |
|------|------|----------------|
| React wrapper | `src/components/chart/CandlestickChart.tsx` | Owns chart lifecycle (create/destroy), refs, ResizeObserver, loading/empty states |
| Pure overlays | `src/components/chart/overlays.ts` | Builds price line + marker configs from domain data — no React, no chart API |
| Pure indicators | `src/lib/indicators.ts` | EMA calculation — no React, no chart API |
| Color constants | `src/lib/chart-colors.ts` | Single source for all chart colors, derived from `:root` CSS vars |

The wrapper is the only file that touches `lightweight-charts` directly. All transformation logic is in pure functions that can be unit-tested without rendering.

## Component API

```ts
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
}
```

The component is a pure visualizer — it does not fetch data itself. PairDetail.tsx wires the hooks and passes everything in. This keeps the chart easy to reuse on other pages (SignalDetail, watchlist preview, etc).

## Data flow

1. PairDetail's `timeframe` state (`"1H"`, `"4H"`, …) is mapped to the DB enum via `UI_TO_DB_TIMEFRAME` (`"1H" → "1h"`).
2. `useCandlesWithFetch(pair, dbTimeframe, 300)` reads `ohlcv_candles` from Supabase. If the newest candle is stale, it auto-triggers the `fetch-candles` Edge Function.
3. The hook returns ascending `OHLCVCandle[]` plus `isLoading` / `isFetching` flags.
4. The chart component converts ISO timestamps to `UTCTimestamp` (Unix seconds), deduplicates by time, and calls `setData`.
5. Three EMA series are computed via `calculateEMA(candles, 20/50/200)` and applied as line overlays.
6. Price lines (entry/SL/TP/support/resistance) and signal markers are rebuilt whenever `analysis`, `marketData`, `signals`, or `candles` change.

## EMA calculation

`src/lib/indicators.ts` exports `calculateEMA(candles, period, field?)`:

- Standard EMA formula: `EMA = price × k + prevEMA × (1 − k)` where `k = 2 / (period + 1)`
- Seeded with the SMA of the first `period` candles
- Returns `TimeValue[]` starting at the `period`-th candle (omits the first `period - 1` for insufficient lookback)
- Returns `[]` if `candles.length < period`

The function takes ascending-sorted candles (which is exactly what `useCandles` returns) and operates in O(n).

**`limit=300`** is passed to `useCandlesWithFetch` so EMA200 has at least ~100 plotted points.

## Overlay system

### Price lines (`buildAnalysisPriceLines` + `buildMarketDataPriceLines`)

| Source | Title | Color | Style |
|--------|-------|-------|-------|
| `analysis.entryZone[0]` | Entry Lo | blue (#3b82f6) | dashed |
| `analysis.entryZone[1]` | Entry Hi | blue (#3b82f6) | dashed |
| `analysis.stopLoss` | SL | red (#ef4444) | solid, width 2 |
| `analysis.tp1` | TP1 | green (#22c55e) | solid, width 2 |
| `analysis.tp2` | TP2 | green | dashed |
| `analysis.tp3` | TP3 | green | dotted (no axis label) |
| `marketData.supportLevel` | Support | translucent green | dashed (no axis label) |
| `marketData.resistanceLevel` | Resistance | translucent red | dashed (no axis label) |

Entry zone is rendered as two lines rather than a shaded band — lightweight-charts has no native horizontal-band primitive. Lines for TP3 and S/R suppress axis labels to reduce clutter (8 lines maximum).

If `analysis` is null or has `verdict === "no_trade"`, no analysis price lines are drawn.

Old price lines are tracked in `priceLinesRef` and removed via `series.removePriceLine()` before new ones are created on every overlay re-render.

### Signal markers (`buildSignalMarkers`)

For each signal, finds the candle with the closest timestamp to `signal.created_at` and places an arrow:

- **Long** → `belowBar`, `arrowUp`, bullish color, text `"Long @ {price}"`
- **Short** → `aboveBar`, `arrowDown`, bearish color, text `"Short @ {price}"`

Markers are sorted by time (required by lightweight-charts) and applied via `createSeriesMarkers(series, markers)` (the v5 plugin API). The plugin instance is held in a ref and updated via `setMarkers()` on subsequent renders.

## Color system

`src/lib/chart-colors.ts` exports `CHART_COLORS` — a const object with literal HSL/hex values.

The colors are derived from the app's `:root` CSS variables in `src/index.css` (`--card`, `--bullish`, `--bearish`, `--muted`, `--muted-foreground`, `--border`). Hardcoding them as literals avoids the need to read CSS variables at runtime, which would require a DOM element at module-init time.

The app is dark-mode only — there is no theme switching, so static color values are appropriate.

## Responsive behavior

The chart container uses a fixed height (`h-[400px] lg:h-[500px]`) rather than `aspect-video`. This is more predictable with lightweight-charts' imperative `resize(width, height)` call than CSS aspect-ratio.

A `ResizeObserver` watches the container div. On every resize event, the chart's `resize(width, height)` is called with the new content rect. This handles window resizes, sidebar collapses, and orientation changes.

## States

| Condition | Render |
|-----------|--------|
| `isLoading && candles.length === 0` | `<Skeleton className="h-[400px] lg:h-[500px] w-full" />` |
| `!isLoading && candles.length === 0` | Empty state with `BarChart3` icon and "No candle data available" message |
| `isFetching && candles.length > 0` | Chart renders normally + small "Updating…" badge in top-right corner |
| Default | Chart with candles, EMAs, price lines, markers, and an EMA legend in top-left |

## lightweight-charts v5 API notes

This implementation targets **v5.1.0** which uses the new series-definition pattern:

```ts
// v5 (current)
const candleSeries = chart.addSeries(CandlestickSeries, options);
const lineSeries = chart.addSeries(LineSeries, options);

// v4 (deprecated, do NOT use)
// const candleSeries = chart.addCandlestickSeries(options);
// const lineSeries = chart.addLineSeries(options);
```

Series markers also moved to a plugin API in v5:

```ts
import { createSeriesMarkers } from "lightweight-charts";
const markersPlugin = createSeriesMarkers(series, markers);
markersPlugin.setMarkers(newMarkers); // update later
```

## Modified files

| File | Action |
|------|--------|
| `package.json` | Added `lightweight-charts ^5.1.0` |
| `src/lib/indicators.ts` | NEW — pure EMA calculation |
| `src/lib/chart-colors.ts` | NEW — color constants |
| `src/components/chart/overlays.ts` | NEW — pure overlay builders |
| `src/components/chart/CandlestickChart.tsx` | NEW — React wrapper |
| `src/pages/PairDetail.tsx` | MODIFIED — replaced placeholder, added candle hook (~10 lines changed) |

## Known limitations

- **Bundle size**: The main JS bundle grew from ~839 KB to ~1019 KB (gzipped: 238 KB → 297 KB). Lightweight-charts is ~150 KB minified. Future improvement: code-split via `React.lazy` so the chart only loads on PairDetail.
- **EMA cold start**: With `limit=300`, EMA200 has ~100 plotted points. Lower timeframes (5m/15m) may show fewer EMA200 points if history is sparse.
- **Marker positioning**: Signal markers snap to the nearest candle by `created_at`. If a signal's creation time falls outside the loaded candle window, it snaps to the most recent candle.
- **No volume pane**: Forex pairs don't have meaningful volume data from Twelve Data. A volume histogram could be added later for XAU/USD.
- **Static dark theme**: Colors are hardcoded for dark mode. If a light theme is added later, `chart-colors.ts` will need to read CSS variables dynamically.
- **Memoization**: The chart re-runs the overlay effect whenever `signals` or `analysis` reference identity changes, even if the underlying data is the same. Wrap parent props in `useMemo` if profiling shows this is hot.

## Future improvements

- Code-split with `React.lazy(() => import("@/components/chart/CandlestickChart"))`
- Add volume histogram pane for XAU/USD
- Add RSI/MACD subchart
- Add drawing tools (trendlines, fibonacci) — requires the lightweight-charts plugin API
- Sync timeframe selection with user preference (persist in trading_accounts table)
