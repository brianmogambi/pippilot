# Schema Hardening — Phase 2

> Implemented 2026-04-08. Added persistence for OHLCV candles, indicator snapshots, generation run logging, and alert state transitions.

## Problem

Edge Functions fetched OHLCV candles (200 H1 + 100 H4 + 60 D1 per pair) and computed indicators (EMA, RSI, ATR, MACD, Bollinger Bands) but discarded everything after producing signals. This made it impossible to:

- Replay or debug why a signal was generated
- Audit what indicator values drove a given signal
- Detect stale or failed Edge Function runs
- Avoid redundant API calls to Twelve Data
- Track alert lifecycle transitions

## New Tables

### `generation_runs` — Edge Function observability

Logs every invocation of `fetch-market-data` and `generate-signals`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| function_name | TEXT | `fetch-market-data` or `generate-signals` |
| batch_index | INTEGER | Nullable — only for `generate-signals` batches 0-7 |
| pairs_processed | TEXT[] | Which symbols were processed |
| started_at | TIMESTAMPTZ | Inserted at function start |
| finished_at | TIMESTAMPTZ | Updated at function end |
| duration_ms | INTEGER | Computed: finished - started |
| status | TEXT | `running` → `success` / `partial` / `failed` |
| error_message | TEXT | Only set on failure |
| candles_fetched | INTEGER | Count of OHLCV rows fetched |
| signals_created | INTEGER | Count of signals written |
| api_credits_used | INTEGER | Twelve Data credits consumed |

**Key behavior:** Status defaults to `running` on insert. Abandoned runs (Edge Function timeout) remain as `running` and are detectable.

### `ohlcv_candles` — Candle storage

Persists OHLCV data fetched from Twelve Data during signal generation.

| Column | Type | Notes |
|--------|------|-------|
| symbol | TEXT | Part of composite PK |
| timeframe | candle_timeframe ENUM | `1h`, `4h`, `1d` |
| candle_time | TIMESTAMPTZ | Candle open time, part of composite PK |
| open, high, low, close | NUMERIC | Price data |
| volume | NUMERIC | Nullable — forex tick volume may not be available |
| fetched_at | TIMESTAMPTZ | When this candle was fetched/updated |

**PK:** `(symbol, timeframe, candle_time)` — natural deduplication on upsert.

**Estimated size:** ~26,000 rows steady-state (16 symbols x retention windows).

### `indicator_snapshots` — Audit trail

Captures computed indicator values at signal generation time. One row per pair per timeframe per run (3 rows per pair).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| run_id | UUID FK | References `generation_runs(id)` ON DELETE CASCADE |
| symbol | TEXT | |
| timeframe | candle_timeframe ENUM | |
| price | NUMERIC | Current price at computation time |
| ema20, ema50, ema200 | NUMERIC | Nullable (NaN → NULL) |
| rsi14, atr14 | NUMERIC | |
| macd_hist | NUMERIC | |
| bb_upper, bb_lower, bb_width | NUMERIC | |
| trend | TEXT | `bullish` / `bearish` / `neutral` |
| created_at | TIMESTAMPTZ | |

**Maps 1:1 to** `TimeframeIndicators` interface in `signal-engine.ts`.

### `alert_state_log` — Alert status transitions

Auto-populated by trigger on `alerts.status` changes.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| alert_id | UUID FK | References `alerts(id)` ON DELETE CASCADE |
| old_status | TEXT | Previous status (nullable for initial state) |
| new_status | TEXT | New status |
| changed_at | TIMESTAMPTZ | |
| changed_by | UUID FK | `auth.uid()` — NULL for system/service_role changes |

## New Functions

### `cleanup_old_candles()`

Retention cleanup, callable from pg_cron or Edge Function.

| Timeframe | Retention |
|-----------|-----------|
| 1h | 30 days |
| 4h | 90 days |
| 1d | 365 days |

Returns `(tf TEXT, deleted_count BIGINT)` for observability.

**Schedule example (pg_cron):**
```sql
SELECT cron.schedule('cleanup-old-candles', '0 3 * * *', 'SELECT * FROM public.cleanup_old_candles()');
```

### `log_alert_status_change()` + trigger

Fires `AFTER UPDATE OF status ON alerts`. Inserts a row into `alert_state_log` only when `old.status IS DISTINCT FROM new.status`.

## New Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| generation_runs | idx_generation_runs_started_at | (started_at DESC) | Dashboard queries |
| generation_runs | idx_generation_runs_function_status | (function_name, status) | Filter by function + status |
| ohlcv_candles | idx_ohlcv_candles_lookup | (symbol, timeframe, candle_time DESC) | Signal engine: latest N candles |
| ohlcv_candles | idx_ohlcv_candles_retention | (timeframe, candle_time) | Retention cleanup |
| indicator_snapshots | idx_indicator_snapshots_run_id | (run_id) | Join to generation runs |
| indicator_snapshots | idx_indicator_snapshots_symbol_time | (symbol, created_at DESC) | Indicator history per pair |
| alert_state_log | idx_alert_state_log_alert_id | (alert_id, changed_at DESC) | Alert history lookup |

## RLS Policies

All new tables follow existing conventions:
- `authenticated` can SELECT (read)
- `service_role` can ALL (Edge Function writes)
- `alert_state_log` additionally scopes SELECT to the alert owner via subquery join

## Edge Function Changes

### `generate-signals/index.ts`
- Creates `generation_runs` row at start with `status: 'running'`
- Persists OHLCV candles to `ohlcv_candles` via batched upsert (500 rows/batch)
- Computes indicators via exported `computeIndicators()` and saves to `indicator_snapshots`
- Finalizes run record with duration, counts, and status at end
- Response now includes `runId`

### `fetch-market-data/index.ts`
- Creates `generation_runs` row at start
- Tracks API credits consumed per batch
- Finalizes run record at end with status and credit count
- Response now includes `runId`

## Migration Files

1. `supabase/migrations/20260408100000_add_ohlcv_and_generation_runs.sql`
   - `candle_timeframe` enum
   - `generation_runs` table + RLS + indexes
   - `ohlcv_candles` table + RLS + indexes
   - `indicator_snapshots` table + RLS + indexes
   - `cleanup_old_candles()` function

2. `supabase/migrations/20260408100100_add_alert_state_log.sql`
   - `alert_state_log` table + RLS + index
   - `log_alert_status_change()` function + trigger

## No Breaking Changes

- No existing tables were altered
- No existing columns were modified
- No existing RLS policies were changed
- Frontend continues to work identically — new tables are backend-only
