# PipPilot AI — Backtest Engine

Phase 10 deliverable: a deterministic historical replay engine that re-runs the live signal engine against stored OHLCV candles, tracks signal lifecycle outcomes, and produces aggregated performance metrics.

This document is the source of truth for: schema, replay rules, no-lookahead guarantees, metrics formulas, and known limitations.

---

## What it is / what it isn't

**Is:** A validation tool. Given a date range, pair set, and timeframe, it answers: *"If we had been running the deterministic signal engine over this period, what signals would it have produced, and how would those trades have resolved?"*

**Isn't:**
- A strategy optimizer or parameter sweeper.
- A money simulator. Metrics are reported in **R-multiples** (units of risk), not dollars. Lot sizing and commissions are out of scope for v1.
- A live performance tracker. The engine never modifies or reads from the live `signals` table.

---

## Data flow

```
config (date range, pairs, timeframes)
        │
        ▼
load ohlcv_candles  ──►  PairCandleSet { h1[], h4[], d1[] }
        │
        ▼
for each cursor in baseTimeframe bars (start..end):
    │
    ├── sliceAtCursor(full, cursor)        ◄── only candles with time ≤ cursor
    │
    ├── analyzeForSignal(pair, sliced, ...) (pure, deterministic)
    │
    ├── if decision is null → continue
    │
    ├── if verdict == "trade":
    │       futureCandles = candles strictly AFTER cursor
    │       outcome = resolveOutcome(signal, futureCandles)
    │       lock pair until outcome.resolvedAt
    │   else:
    │       outcome = no_entry
    │
    └── persist { backtest_signals row, signal_outcomes row }

aggregate → backtest_results
update backtest_runs.status = success
```

---

## Schema

Migration: [`supabase/migrations/20260414100000_add_backtest_tables.sql`](supabase/migrations/20260414100000_add_backtest_tables.sql)

### `backtest_runs`
Run metadata and config snapshot. One row per `POST /run-backtest` invocation.

| column | meaning |
|---|---|
| `id` | UUID primary key |
| `label` | Human-readable name |
| `status` | `pending` → `running` → `success` / `partial` / `failed` |
| `config` | JSONB snapshot of `BacktestConfig` (see below) |
| `started_at` / `finished_at` / `duration_ms` | Timing |
| `error_message` | Set on failure |
| `signal_engine_version` | String tag for engine version (see "Determinism") |
| `created_by` | Optional auth.users FK; null in v1 |

### `backtest_signals`
Every signal generated during a run. One row per cursor where the engine emitted a signal (including `verdict='no_trade'` decisions).

Notable columns:
- `cursor_time` — replay "now" when the engine was called
- `raw_output` — full SignalOutput as JSONB (audit trail)
- All entry/SL/TP levels mirror the live `signals` table
- FK: `run_id` → `backtest_runs(id)` on delete cascade

### `signal_outcomes`
Lifecycle resolution for a signal. Generic: can FK either to `backtest_signals` or to live `signals`. Phase 10 only writes the backtest variant; Phase 11 will populate live rows using the same resolver.

A check constraint enforces: exactly one of `backtest_signal_id` / `live_signal_id` must be set.

Notable columns:
- `outcome` — one of `entry_hit | tp1_hit | tp2_hit | tp3_hit | sl_hit | invalidated | expired | no_entry`
- `r_multiple` — `(exit−entry)/(entry−sl)`, sign-adjusted for direction
- `pips_result` — directional move in pips
- `bars_to_resolution` — base-timeframe bars from cursor to resolution
- `resolution_path` — JSONB array of `{barTime, event}` entries; the audit trail of how this trade was resolved

### `backtest_results`
One aggregated row per run.

Stores: `total_signals`, `total_trades`, `wins`, `losses`, `win_rate`, `avg_r`, `expectancy_r`, `max_drawdown_r`, `profit_factor`, plus three JSONB breakdowns: `breakdown_by_pair`, `breakdown_by_setup`, `breakdown_by_timeframe`.

---

## How to run

```bash
supabase functions serve run-backtest
```

Invoke with a config payload:

```bash
curl -X POST http://localhost:54321/functions/v1/run-backtest \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "smoke-eurusd-7d",
    "config": {
      "startDate": "2026-04-01T00:00:00Z",
      "endDate":   "2026-04-08T00:00:00Z",
      "pairs": ["EUR/USD"],
      "timeframes": ["1h","4h","1d"],
      "setupTypesEnabled": ["trend_pullback","breakout_retest","range_reversal","momentum_breakout","sr_rejection"],
      "baseTimeframe": "1h",
      "maxHoldingBars": 48,
      "startingBalance": 10000,
      "riskPerTradePct": 1
    }
  }'
```

Expected response:

```json
{ "success": true, "run_id": "<uuid>", "signals": 12, "metrics": { ... } }
```

---

## No-lookahead guarantees

The hard invariant: at cursor `t`, the signal engine sees only candles whose close time is `≤ t`.

**Where enforced:**
- [`src/lib/backtest/slice-timeframe.ts`](src/lib/backtest/slice-timeframe.ts) — single point of enforcement. `sliceCandlesAtCursor(candles, cursorISO)` does a binary search for the largest index `i` where `candles[i].time ≤ cursor` and returns `candles.slice(0, i+1)`.
- The replay loop in [`src/lib/backtest/replay-loop.ts`](src/lib/backtest/replay-loop.ts) calls `sliceAtCursor` before every engine invocation.
- The outcome resolver receives candles via `futureCandlesAfter(...)`, which returns only bars with time strictly **after** the cursor — the resolver cannot see bars at or before the cursor.

**Where verified:**
- `src/lib/backtest/__tests__/slice-timeframe.test.ts` — randomized property test: 1000 random cursors over 500 candles, asserts `max(sliced[].time) ≤ cursor` always.
- `src/lib/backtest/__tests__/replay-order.test.ts` — at every engine call during the loop, asserts every candle in every timeframe of the slice is ≤ cursor.

---

## Outcome resolution rules

Implemented in [`src/lib/backtest/outcome-resolver.ts`](src/lib/backtest/outcome-resolver.ts).

### Entry fill
- Market entry filled at the **next bar's open** (we treat the engine's `entryPrice` as the fill price).
- Limit / zone entries are not modeled in v1.

### Per-bar resolution priority

For each forward bar starting at the fill bar, in order:

**Long signal:**
1. If `bar.low ≤ stopLoss` → **`sl_hit`** (PESSIMISTIC — wins all collisions)
2. Else if `bar.high ≥ tp3` → **`tp3_hit`**
3. Else if `bar.high ≥ tp2` → **`tp2_hit`**
4. Else if `bar.high ≥ tp1` → **`tp1_hit`**
5. Else continue to next bar.

**Short signal:** mirrored (high ↔ low, ≥ ↔ ≤).

### Pessimistic same-bar collision

If a single bar's range touches both the SL and one or more TPs, the resolver picks **SL hit**. Without tick data we cannot know intrabar order; this is the honest default.

This rule is asserted in `outcome-resolver.test.ts` for both long and short directions.

### Expiration

After `maxHoldingBars` forward bars without resolution, the trade is marked **`expired`** and `exit_price` is set to the last walked bar's close. R-multiple is computed against the close price.

### No future data

If there are no candles after the cursor (e.g. the cursor is at the end of the loaded range), the outcome is **`no_entry`** and no R is recorded.

---

## Metrics

Implemented in [`src/lib/backtest/metrics.ts`](src/lib/backtest/metrics.ts).

| metric | formula |
|---|---|
| `total_signals` | count of all backtest_signals rows |
| `total_trades` | count where `verdict='trade'` AND outcome is not `no_entry` |
| `wins` | count where outcome ∈ {`tp1_hit`,`tp2_hit`,`tp3_hit`} |
| `losses` | count where outcome = `sl_hit` |
| `win_rate` | `wins / (wins + losses)` (resolved-only denominator; expired trades excluded) |
| `avg_r` | `sum(rMultiple) / total_trades` (includes expired) |
| `expectancy_r` | currently equal to `avg_r` (per-trade expected R) |
| `max_drawdown_r` | walk equity curve (cumulative R, chronological); `max(peak − equity)` |
| `profit_factor` | `sum(winning R) / |sum(losing R)|`; null if no losers and no winners |

**Breakdowns** (`by_pair`, `by_setup`, `by_timeframe`) are stored as JSONB objects keyed by the dimension value, each containing `{trades, wins, losses, winRate, avgR, expectancyR, totalR}`.

---

## Determinism & engine versioning

The signal engine ([`supabase/functions/_shared/signal-engine.ts`](supabase/functions/_shared/signal-engine.ts)) is pure and deterministic — the same inputs always produce the same `SignalOutput`. Backtest results are therefore byte-stable for a given engine version.

`backtest_runs.signal_engine_version` stores a short marker (`phase10-2026-04-14` in v1). When the engine is updated, bump this constant in `supabase/functions/run-backtest/index.ts` so historical runs can be filtered out / re-run as needed. A future enhancement could compute a real content hash at runtime.

---

## Audit trail

For any backtest signal:

```sql
select bs.cursor_time, bs.pair, bs.direction, bs.setup_type,
       so.outcome, so.r_multiple, so.bars_to_resolution,
       so.resolution_path
from backtest_signals bs
join signal_outcomes so on so.backtest_signal_id = bs.id
where bs.id = '<uuid>';
```

`resolution_path` is an ordered JSONB array showing exactly which bar triggered the resolution event:

```json
[
  { "barTime": "2026-04-01T03:00:00Z", "event": "entry filled @ 1.0853" },
  { "barTime": "2026-04-01T05:00:00Z", "event": "TP1 hit @ 1.0878" }
]
```

Combined with `backtest_signals.raw_output` (the full `SignalOutput` JSONB at cursor time), this is enough to fully reconstruct *why* and *when* a backtest signal resolved the way it did.

---

## Limitations (v1)

1. **No spread / slippage modeling.** Entry fills at the engine's declared entry price, exits at the level price. Reality has friction.
2. **No lot / commission modeling.** All metrics are R-based. `startingBalance` and `riskPerTradePct` are persisted in `config` for Phase 11 use but do not affect any v1 math.
3. **Same-bar SL/TP collision → pessimistic (SL first).** Without tick data this is the honest choice; expect win rates to be slightly understated vs. reality.
4. **Resolution timeframe = base timeframe.** Sub-bar TP/SL hits are invisible. Expect TP frequency to be slightly understated; consistent across runs.
5. **Market-entry fill on next bar's open.** Limit / zone orders not modeled. Most live engine outputs are near-market, so deviation is small.
6. **Session filter is a UTC hour heuristic** (`[7..21)`). Matches `generate-signals/index.ts`.
7. **Replay dedup is conservative.** Once a `trade` verdict signal is emitted for a pair, no further signals are emitted for that pair until the trade resolves. Mirrors live engine behavior.
8. **Backtest runs are global, not per-user.** RLS allows authenticated SELECT for everyone; service role for writes.
9. **Candle history coverage is bounded by ingestion.** `fetch-candles` keeps ~200 H1 / 100 H4 / 60 D1 bars per pair. A meaningful multi-month backtest requires a one-time historical backfill; this is **not** a Phase 10 deliverable.
10. **End-to-end replay using the real Deno signal engine is not vitest-tested** (signal engine is Deno-only). Unit tests cover the replay loop with a stub engine plus all pure helpers; full E2E is validated via the edge function smoke test.

---

## File map

**Pure helpers (vitest-tested):**
- `src/lib/backtest/types.ts`
- `src/lib/backtest/slice-timeframe.ts`
- `src/lib/backtest/outcome-resolver.ts`
- `src/lib/backtest/metrics.ts`
- `src/lib/backtest/replay-loop.ts`
- `src/lib/backtest/__tests__/*.test.ts` (4 files, 27 tests)

**Deno mirrors (used by edge function):**
- `supabase/functions/_shared/backtest/{types,slice-timeframe,outcome-resolver,metrics,replay-loop}.ts`

**Edge function:**
- `supabase/functions/run-backtest/index.ts`

**Schema:**
- `supabase/migrations/20260414100000_add_backtest_tables.sql`

**Reused (unchanged):**
- `supabase/functions/_shared/signal-engine.ts` — `analyzeForSignal()` is the only entry point called per cursor
- `supabase/functions/_shared/pip-value.ts` — `pipMultiplier()` for pip-size derivation
- `ohlcv_candles` table — sole source of historical price data

---

## Next steps (Phase 11)

The cleanest entry point is **live signal outcome tracking**. The `signal_outcomes` table was deliberately designed with both `backtest_signal_id` and `live_signal_id` columns. Phase 11 would:

1. Add a scheduled edge function that walks live `signals` rows forward across newly-ingested candles.
2. Reuse `outcome-resolver.ts` verbatim — no new logic.
3. Insert `signal_outcomes` rows with `live_signal_id` set.

This immediately gives the app live win-rate stats alongside backtest stats, using the same resolver, so the numbers are directly comparable. Backtest = "what the engine said would happen"; live = "what actually happened".
