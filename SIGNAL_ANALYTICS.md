# Signal Analytics — Phase 11

This document is the source of truth for the analytics layer that
measures signal and strategy quality on top of PipPilot's deterministic
signal engine and the Phase 10 backtest foundation.

The analytics layer is **deterministic and explainable**. There is no AI
in this path. Every metric is computed in pure TypeScript over rows
loaded from Postgres. The same code runs over backtest results and live
signals because both share the `signal_outcomes` table introduced in
Phase 10.

---

## 1. Data sources

| Source | Tables | Notes |
|---|---|---|
| Backtest signals | `backtest_signals` ⟶ `signal_outcomes (backtest_signal_id)` | One outcome row per signal. Loaded by `fetchBacktestSignalsWithOutcomes(client, runId)` in `src/lib/analytics/queries.ts`. |
| Live signals | `signals` ⟶ `signal_outcomes (live_signal_id)` | Outcomes are written nightly by the `resolve-live-outcomes` edge function. Signals without an outcome row are still in flight and are skipped by analytics. Loaded by `fetchLiveSignalsWithOutcomes(client, filters)`. |
| Trade journal | `trade_journal_entries` | Realized pips/amount per user trade. No `setup_type`/`confidence`, so journal analytics is a much thinner shape (`JournalOutcome`). Loaded by `fetchJournalOutcomes(client, userId, range)`. |
| OHLCV candles | `ohlcv_candles` | Used by the live resolver and (optionally) by `computeNoTradeQuality` to replay no_trade rows. |

The two signal sources are mapped onto the same in-memory shape
(`SignalWithOutcome` from `src/lib/backtest/types.ts`) by adapters in
`src/lib/analytics/queries.ts`. Once mapped, the analytics service does
not care whether the rows came from a backtest run or from production.

---

## 2. Metric definitions

Every metric below is implemented in `src/lib/analytics/`. The names in
parentheses are the symbols you can import.

### 2.1 Reused from `src/lib/backtest/metrics.ts`

`computeMetrics()` is the same function the backtest engine uses. The
analytics service calls it unchanged so backtest and live analytics are
guaranteed to be apples-to-apples.

| Metric | Symbol | Definition |
|---|---|---|
| Total signals | `metrics.totalSignals` | Every row, including `verdict=no_trade`. |
| Total trades | `metrics.totalTrades` | Rows with `verdict=trade` AND `outcome.kind != no_entry`. |
| Wins / Losses | `metrics.wins / metrics.losses` | TP1/2/3 hits vs SL hits. |
| Win rate | `metrics.winRate` | wins / (wins + losses). |
| Avg R / Expectancy | `metrics.avgR`, `metrics.expectancyR` | Mean R per trade across all trades (resolved or open). |
| Profit factor | `metrics.profitFactor` | Sum of winning R / abs(sum of losing R). `null` when no losing R. |
| Max drawdown | `metrics.maxDrawdownR` | Max(peak − equity) walking the chronological equity curve. |
| Per-pair / setup / timeframe breakdowns | `metrics.breakdownByPair / BySetup / ByTimeframe` | Same `BreakdownStats` shape with trades, wins, losses, win rate, avg R, total R. |

### 2.2 Added in Phase 11

| Metric | Symbol | Where | What it answers |
|---|---|---|---|
| Equity curve | `equityCurve: EquityPoint[]` | `equity-curve.ts` | Cumulative R per resolved trade, in chronological order. The presentation-friendly version of the loop already inside `metrics.ts`. |
| Confidence calibration | `confidenceBuckets: ConfidenceBucket[]` | `confidence-calibration.ts` | "Does the engine's 80+ confidence band actually outperform 60–80?" Buckets: `[0,40)`, `[40,60)`, `[60,80)`, `[80,101)`. |
| No-trade quality | `noTradeQuality: NoTradeQualityStats` | `no-trade-quality.ts` | For each `verdict=no_trade` row with forward candles, replays the resolver as if the trade had been taken. Reports would-have-won / would-have-lost / would-have-expired and a miss rate. |
| Sample-size-gated setup stats | `setupRStats` | `setup-r-stats.ts` | Wraps `metrics.breakdownBySetup` with an `insufficientSample` flag (true when trades < 5). |
| Per-(pair × timeframe) stats | `pairTimeframeStats` | `setup-r-stats.ts` | Cross-tab the engine's pair and timeframe breakdowns into a single keyed map (`"EUR/USD\|H1"`). |
| Data-gap count | `dataGapCount: number` | `index.ts` | Items where `outcome.kind === "expired"` but `barsToResolution < maxHoldingBars`. Suggests an OHLCV ingestion gap, not an honest expiration. |

The top-level entry point is `analyze(input: AnalyticsInput): AnalyticsOutput`
in `src/lib/analytics/index.ts`. It is a pure function — no Supabase, no
React.

---

## 3. Sample-size gating rules

`MIN_SAMPLE_SIZE = 5`. Any breakdown bucket (per setup, per pair ×
timeframe, per confidence bucket, no-trade quality block) with fewer
trades than this is flagged `insufficientSample: true`. The flag is
informational — the metric is still computed — but UI consumers should
suppress it from headline numbers and grey it out.

The threshold is intentionally low (this is decision-support, not
academic statistics). It exists to prevent "100% win rate on the only 1
trade we took" from showing up as a positive signal.

---

## 4. How to run analytics

### From a React component

```ts
import { useLiveSignalAnalytics, useBacktestAnalytics } from "@/hooks/use-analytics";

const live = useLiveSignalAnalytics({
  since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
});

const backtest = useBacktestAnalytics(runId);
```

Both hooks return `UseQueryResult<AnalyticsOutput>`. They are read-only;
they do not invalidate any other query.

### From a script (CI / debugging)

```ts
import { createClient } from "@supabase/supabase-js";
import { analyze, fetchLiveSignalsWithOutcomes } from "@/lib/analytics";

const client = createClient(SUPABASE_URL, SERVICE_KEY);
const items = await fetchLiveSignalsWithOutcomes(client, {
  since: "2026-04-01T00:00:00Z",
  pairs: ["EUR/USD"],
});
const result = analyze({ items });
console.log(result.metrics, result.confidenceBuckets);
```

### Running the live outcome resolver

The resolver is an edge function. Trigger it manually or via cron:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/resolve-live-outcomes" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lookbackDays": 14, "maxHoldingBars": 24}'
```

Idempotent. Skips signals that already have an outcome row and signals
that are still in flight (insufficient forward candles). Writes a
`generation_runs` row so executions show up in the existing observability
view.

---

## 5. Data quality caveats

Read these before drawing conclusions from the numbers.

1. **Free-form legacy `review_tag` values.** Before the Phase 11 CHECK
   constraint (migration `20260411120000_normalize_review_tags.sql`),
   reviewers could write any string. The migration coerces stragglers
   to `needs_review`; pre-migration reviews lose specificity.

2. **No live outcomes existed pre-Phase-11.** The first ~14 days of
   live-signal analytics after the resolver is enabled will be sparse.
   Trust the `insufficientSample` flag.

3. **Journal entries lack `setup_type` and `confidence`.** Journal
   analytics is necessarily limited to pair / direction / realized
   pips / realized amount.

4. **OHLCV gaps cause false expirations.** If Twelve Data misses a
   window, the resolver will mark a signal `expired` even though it
   never reached the holding window. `analyze()` exposes this as
   `dataGapCount`. Treat any non-zero value as a request to backfill
   `ohlcv_candles` before re-running analytics.

5. **Same-bar TP/SL collisions are pessimistic.** The resolver's
   priority order (`outcome-resolver.ts:25-30`) gives SL the win when a
   single bar touches both. This is the correct default without tick
   data, but realized R is a lower bound.

6. **No tick data.** Intrabar ordering is unknown. R-multiples are
   lower-bound estimates.

7. **Confidence buckets must not span engine versions.**
   `backtest_runs.signal_engine_version` exists, but live `signals` rows
   have no version column. Cross-version calibration is unsafe — you
   should never merge live items collected before and after a signal
   engine bump into one calibration run. The analytics layer does not
   enforce this; the caller (Phase 12 UI) must.

---

## 6. Review tag vocabulary

Enforced by CHECK constraint on `signals.review_tag` and
`alerts.review_tag` (see `supabase/migrations/20260411120000_normalize_review_tags.sql`).

| Tag | Meaning |
|---|---|
| `good_signal` | Confirmed correct call. |
| `false_positive` | Signal fired but should not have. |
| `weak_setup` | Borderline / low-quality but not clearly wrong. |
| `overconfident` | Confidence score did not match realized R. |
| `needs_review` | Flagged for follow-up. |
| `NULL` | Unreviewed. |

The admin review panel (`src/pages/AdminReview.tsx`) writes these via
the existing `useReviewSignal()` mutation — Phase 11 only added the new
buttons; the data path is unchanged from Phase 4.

---

## 7. Files

```
src/lib/analytics/
  types.ts                      # AnalyticsInput / Output, ConfidenceBucket, ...
  index.ts                      # analyze() — top-level entry point
  equity-curve.ts               # computeEquityCurve()
  confidence-calibration.ts     # computeConfidenceBuckets()
  no-trade-quality.ts           # computeNoTradeQuality()
  setup-r-stats.ts              # gateSetupBreakdown(), computePairTimeframeStats()
  queries.ts                    # Supabase adapters (pure functions)
  __tests__/*.test.ts           # vitest

src/lib/backtest/
  live-outcome-adapter.ts       # browser/test mirror of the Deno adapter

src/hooks/
  use-analytics.ts              # React Query wrappers

supabase/functions/resolve-live-outcomes/
  index.ts                      # Live outcome resolver (Deno edge function)

supabase/functions/_shared/backtest/
  live-outcome-adapter.ts       # Deno adapter (mirror of src/lib/backtest)

supabase/migrations/
  20260411120000_normalize_review_tags.sql
```
