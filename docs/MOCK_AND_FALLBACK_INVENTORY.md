# Mock & Fallback Inventory

> Generated 2026-04-08. Documents what was removed in the Phase 1 mock elimination.

## Deleted Files

### `src/data/mockMarketData.ts` (164 lines) — DELETED
- `mockMarketData`: Hardcoded `Record<string, MarketData>` for 15 forex pairs (EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF, XAU/USD)
- `mockPairAnalysis`: Hardcoded `Record<string, PairAnalysis>` for 6 pairs (EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, EUR/CHF) with full setup details, AI explanations, reasons for/against
- `getMarketData(symbol)`: Returned mock data or zero-value fallback
- `getPairAnalysis(symbol)`: Returned mock analysis or null
- Type re-exports for backward compatibility (moved to `@/types/trading`)

### `src/data/mockSignals.ts` (262 lines) — DELETED
- `mockSignals[]`: 8 hardcoded signals
- `mockAlerts[]`: 7 hardcoded alerts
- `mockAccountStats`: Hardcoded $10K balance/equity
- `mockNotifications[]`: 6 notification messages
- `mockJournalEntries[]`: 10 historical trade entries
- `mockMarketSummary[]`: 8 pairs with price/change/sentiment
- `mockWatchlistData[]`: 7 watchlist pairs
- `watchlistPairs`: Hardcoded symbol array

### `src/data/` directory — DELETED (was empty after file removal)

## Removed Import Sites

| File | What was imported | Replacement |
|------|-------------------|-------------|
| `src/hooks/use-market-data.ts` | `getMockMarketData`, `getMockPairAnalysis`, `mockMarketSummary` | Returns `null` or `[]` when no data |
| `src/hooks/use-signals.ts` | `mockPairAnalysis` | Returns `null` analysis when no DB row |
| `src/pages/Watchlist.tsx` | `getMockMarketData` | Uses inline empty `MarketData` with `hasLiveData` flag |

## Removed Hardcoded Defaults

| Location | Old Default | New Behavior |
|----------|-------------|--------------|
| `Index.tsx:48` | `balance ?? 10000` | `balance ?? 0` + setup prompt when no account |
| `Index.tsx:49` | `equity ?? 10000` | `equity ?? 0` + setup prompt when no account |
| `Index.tsx:58-60` | Watchlist fell back to `marketSummary.slice(0,5)` (which itself could be mock) | Shows empty state message |

## Remaining Fallbacks (kept intentionally)

| Location | Fallback | Reason | Phase 9 surfacing |
|----------|----------|--------|-------------------|
| `src/lib/pip-value.ts:71-95` | `DEFAULT_PIP_VALUES` (15 pairs, static USD values) | Safety net when live prices momentarily unavailable. `freshness` flag communicates status | Risk Calculator "Pip Value" cell sub-label (`live` / `estimated`); `useDailyRiskUsed` exposes `pipFreshness` for consumers that want a badge |
| `src/lib/pip-value.ts:97-99` | `getDefaultPipValueUSD()` returns hardcoded or 10 | Ultimate fallback for unknown pairs | Same `freshness === "fallback"` path as above |
| `Index.tsx` | `max_daily_loss_pct ?? 5` | Reasonable default for risk profiles not yet configured | "Risk Used Today" stat-card sub-label appends `(default)` when `riskProfile?.max_daily_loss_pct` is null |
| `supabase/functions/_shared/signal-engine.ts:399-477` (`generateExplanations` / `generateReasons`) | Deterministic template prose for `beginner_explanation`, `expert_explanation`, `reasons_for`, `reasons_against`, `no_trade_reason` | Phase 8: explanation-service falls back to these templates when `ANTHROPIC_API_KEY` is missing or the AI call fails. Observable via `pair_analyses.explanation_status ∈ {ai_skipped, ai_failed, template_only}` and the per-run `generation_runs.ai_calls_*` counters | `SignalDetailDrawer.tsx` "Explanation" header now carries a freshness badge derived from `analysis.explanationStatus` (live = ai_success, cached = ai_failed, fallback = ai_skipped/template_only). Tooltip names model + prompt version on success, error code on failure |
| `market_data_cache` row missing for a symbol | UI renders zeroed `MarketData` | Phase 1: empty cache before Edge Function first run | Phase 9: every consumer (Dashboard, Watchlist, PairDetail) renders a `Demo` badge and dashes (`—`) instead of zero values. `useMarketData(symbol)` returns `freshness: "fallback"`. |
| `market_data_cache.updated_at >= 10 min` | Stale row still rendered | Edge Function refreshes every ~5 min; brief overruns are tolerable | Phase 9: row carries a `Cached` badge with tooltip "Updated N minutes ago". Threshold is `STALE_THRESHOLD_MS` in `src/lib/data-freshness.ts`. |
