# Candle Data Service — Phase 3

> Implemented 2026-04-09. Adds on-demand OHLCV candle fetching for 5 timeframes, typed frontend hooks, and rate-limit-aware incremental updates.

## Architecture

```
┌─────────────┐      useCandles()       ┌────────────────┐
│  PairDetail  │ ◄──── React Query ────► │  ohlcv_candles │
│  (chart UI)  │                         │   (Supabase)   │
└──────┬───────┘                         └───────▲────────┘
       │                                         │
       │  useCandlesWithFetch()                  │ batched upsert
       │  auto-triggers if stale                 │
       ▼                                         │
┌──────────────┐    supabase.functions    ┌──────┴────────┐
│ useFetchCandles│ ─────invoke()────────► │ fetch-candles  │
│  (mutation)   │                         │ Edge Function  │
└───────────────┘                         └──────┬────────┘
                                                 │
                                          GET /time_series
                                                 │
                                          ┌──────▼────────┐
                                          │  Twelve Data   │
                                          │     API        │
                                          └───────────────┘
```

## Staleness-Driven Fetch Strategy

The system avoids unnecessary API calls by checking data freshness before fetching:

1. **Frontend layer** (`useCandlesWithFetch`): Reads cached candles from `ohlcv_candles` via React Query. If the newest candle is older than the staleness threshold, triggers the Edge Function.

2. **Edge Function layer** (`fetch-candles`): Before calling Twelve Data, queries `MAX(candle_time)` for the symbol+timeframe. If data is within the staleness threshold, returns `{ status: "fresh" }` immediately — zero API credits consumed.

3. **Debounce**: The frontend ref (`lastFetchAttempt`) prevents re-triggering within the staleness window, even if the React Query cache updates.

### Staleness Thresholds

| Timeframe | Staleness Threshold | Meaning |
|-----------|-------------------|---------|
| 5m | 10 minutes | ~2 candles old |
| 15m | 30 minutes | ~2 candles old |
| 1h | 2 hours | ~2 candles old |
| 4h | 8 hours | ~2 candles old |
| 1d | 48 hours | ~2 candles old |

## Rate Limit Budget

Twelve Data free tier: **8 API credits per minute**.

### Credit consumption by Edge Function

| Function | Credits per call | Frequency | Guard mechanism |
|----------|-----------------|-----------|-----------------|
| `fetch-candles` | 1 | On demand (user views chart) | `generation_runs` count: max 7 calls/min |
| `generate-signals` | 6 | Scheduled (~every 15 min) | 2 symbols × 3 timeframes per batch |
| `fetch-market-data` | 16 | Scheduled (~every 5 min) | 2 batches of 8 with 61s pause between |

### Rate limit guard (fetch-candles)

Before calling Twelve Data, the Edge Function counts recent `generation_runs` rows:

```sql
SELECT count(*) FROM generation_runs
WHERE function_name = 'fetch-candles'
  AND started_at > now() - interval '60 seconds'
```

If count >= 7, the function returns HTTP 429 with `{ retryAfter: 60 }`.

This is a server-side guard — even if multiple browser tabs trigger fetches simultaneously, the Edge Function serializes through the database check.

## Incremental Update Algorithm

```
1. Query MAX(candle_time) for (symbol, timeframe)
2. If no rows exist → fetch defaultOutputsize candles (first load)
3. If newest candle is within staleness threshold → return "fresh" (skip API)
4. Otherwise:
   a. gap = now - newestCandleTime
   b. candlesNeeded = ceil(gap / intervalMs) + 5 (overlap buffer)
   c. outputsize = min(candlesNeeded, defaultOutputsize)
5. Fetch from Twelve Data with calculated outputsize
6. Upsert into ohlcv_candles (PK deduplication handles overlap)
```

The 5-candle overlap buffer ensures no gaps from clock skew or market close periods. The composite primary key `(symbol, timeframe, candle_time)` means upserts naturally deduplicate.

## Default Fetch Sizes

| Timeframe | Default Outputsize | Approximate Coverage |
|-----------|-------------------|---------------------|
| 5m | 300 | ~1 trading day |
| 15m | 200 | ~2 trading days |
| 1h | 200 | ~8 trading days |
| 4h | 100 | ~17 trading days |
| 1d | 60 | ~2 months |

## Retention Policy

Managed by `cleanup_old_candles()`, scheduled via pg_cron at 03:00 UTC daily.

| Timeframe | Retention | Estimated Rows (16 symbols) |
|-----------|-----------|---------------------------|
| 5m | 7 days | ~32,256 |
| 15m | 14 days | ~21,504 |
| 1h | 30 days | ~11,520 |
| 4h | 90 days | ~8,640 |
| 1d | 365 days | ~5,840 |
| **Total** | | **~79,760** |

## Hook API Reference

### `useCandles(symbol, timeframe, limit?)`

Reads the latest N candles from `ohlcv_candles`. Returns ascending-sorted `OHLCVCandle[]`.

```typescript
const { data, isLoading, error } = useCandles("EUR/USD", "1h", 200);
```

- **Query key:** `["candles", symbol, timeframe, limit]`
- **Enabled:** only when user is authenticated and symbol/timeframe are truthy
- **Stale time:** varies by timeframe (60s for 5m, up to 3600s for 1d)

### `useCandlesInRange(symbol, timeframe, from, to)`

Reads candles within a specific ISO 8601 date range.

```typescript
const { data } = useCandlesInRange("EUR/USD", "1h", "2026-04-01", "2026-04-08");
```

- **Query key:** `["candles-range", symbol, timeframe, from, to]`
- **Enabled:** only when all parameters are truthy

### `useFetchCandles()`

Mutation that triggers the `fetch-candles` Edge Function.

```typescript
const fetchMutation = useFetchCandles();
fetchMutation.mutate({ symbol: "EUR/USD", timeframe: "1h" });
```

- **On success:** invalidates all `["candles", symbol, timeframe]` and `["candles-range", symbol, timeframe]` queries
- **Returns:** `{ status, candles?, runId? }`

### `useCandlesWithFetch(symbol, timeframe, limit?)`

Combined hook: reads from DB and auto-triggers the Edge Function if data is stale or empty.

```typescript
const { data, isFetching, fetchError } = useCandlesWithFetch("EUR/USD", "1h");
```

- **Auto-fetch trigger:** fires when candles are empty or newest candle exceeds staleness threshold
- **Debounce:** skips re-fetch if last attempt was within the staleness window
- **`isFetching`:** true when either the DB query is loading or the Edge Function is pending

## Type Mappings

### UI Toggle → DB Enum → Twelve Data Interval

| UI Value | DB `candle_timeframe` | Twelve Data `interval` |
|----------|----------------------|----------------------|
| `"5m"` | `'5m'` | `5min` |
| `"15m"` | `'15m'` | `15min` |
| `"1H"` | `'1h'` | `1h` |
| `"4H"` | `'4h'` | `4h` |
| `"1D"` | `'1d'` | `1day` |

Use `UI_TO_DB_TIMEFRAME` from `src/types/trading.ts` to convert PairDetail toggle values to database enum values.

## Supported Symbols

```
EUR/USD  GBP/USD  USD/JPY  AUD/USD  USD/CAD
NZD/USD  EUR/GBP  GBP/JPY  EUR/JPY  AUD/JPY
CHF/JPY  EUR/AUD  GBP/AUD  EUR/CAD  USD/CHF
XAU/USD
```

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260409100000_extend_candle_timeframes.sql` | Adds 5m/15m to enum, updates retention function |
| `supabase/functions/fetch-candles/index.ts` | Edge Function: Twelve Data → ohlcv_candles |
| `src/types/trading.ts` | `CandleTimeframe`, `OHLCVCandle`, `UI_TO_DB_TIMEFRAME` |
| `src/hooks/use-candles.ts` | 4 React hooks for candle data access |

## Known Limitations

- **Auto-generated Supabase types are stale**: `src/integrations/supabase/types.ts` does not include Phase 2/3 tables. Hooks use manual type casts. Run `npx supabase gen types` after applying migrations to remove the casts.
- **No WebSocket streaming**: Candles are polled via staleness checks, not pushed in real-time. Supabase Realtime subscriptions could be added later.
- **Forex volume**: Twelve Data does not provide volume for forex pairs. The `volume` column is always NULL for forex; only XAU/USD may have volume data.
- **Market hours**: The staleness check does not account for market close periods (weekends, holidays). A fetch may be triggered unnecessarily on Saturday/Sunday and will return the same Friday candles.
