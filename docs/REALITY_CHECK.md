# Reality Check — Data Path Classification

> Generated 2026-04-08. Audit of every frontend data path: what is real, what was mock, and what was changed.

## Classification Key

- **REAL** — queries Supabase directly, shows empty/loading state if no data
- **REAL (frontend-computed)** — derives values from real backend data using frontend math
- **PARTIAL (kept)** — has a static fallback that is intentional and flagged to the user

## Data Paths

| Data Path | Hook / File | Status | Notes |
|-----------|-------------|--------|-------|
| Signals list | `use-signals.ts:useSignals()` | REAL | Returns `[]` if empty |
| Active signals | `use-signals.ts:useActiveSignals()` | REAL | Returns `[]` if empty |
| Signals by pair | `use-signals.ts:useSignalsByPair()` | REAL | Returns `[]` if empty |
| Signal enrichment (analysis) | `use-signals.ts:useSignals()` L82 | REAL | Returns `null` analysis when no DB row — was mock fallback |
| Quality filter | `use-signals.ts:getQualityFromEnrichedSignal()` | REAL | Reads from enriched signal's analysis — was reading mock |
| Market data (all) | `use-market-data.ts:useAllMarketData()` | REAL | Returns `null` if cache empty |
| Market data (single) | `use-market-data.ts:useMarketData()` | REAL | Returns `null` — was mock fallback |
| Pair analysis | `use-market-data.ts:usePairAnalysis()` | REAL | Returns `null` — was mock fallback |
| Market summary | `use-market-data.ts:useMarketSummary()` | REAL | Returns `[]` — was mock fallback |
| Pip values | `use-pip-value.ts` | PARTIAL (kept) | Live calculation from prices; static fallback with `isLive: false` flag. Calculator shows "est." label |
| Daily risk | `use-daily-risk.ts` | REAL (frontend-computed) | Queries open journal entries, computes in frontend |
| Trading account | `use-account.ts:useTradingAccount()` | REAL | Returns `null` if none |
| Risk profile | `use-account.ts:useRiskProfile()` | REAL | Returns `null` if none |
| Journal entries | `use-journal.ts` | REAL | Full CRUD on `trade_journal_entries` |
| Journal stats | `use-journal.ts:useJournalStats()` | REAL (frontend-computed) | Computed from journal data |
| Alerts | `use-alerts.ts` | REAL | Full CRUD on `alerts` |
| Watchlist | `use-watchlist.ts` | REAL | Full CRUD on `user_watchlist` |
| Instruments | `use-watchlist.ts:useInstruments()` | REAL | Queries `instruments` |
| Profile / Auth | `AuthContext.tsx` | REAL | Queries `profiles` |
| Admin hooks | `use-admin.ts` | REAL | Queries with role checks |
| Dashboard account stats | `Index.tsx` | REAL | Shows setup prompt when no account — was $10K default |
| Dashboard watchlist | `Index.tsx` | REAL | Shows empty state when no data — was mock market summary fallback |
| Watchlist page market data | `Watchlist.tsx` | REAL | Shows "—" for missing prices — was mock fallback |
| R:R calculation | `SignalCard.tsx`, `SignalDetail.tsx` | REAL (frontend-computed) | Math from entry/SL/TP |
| Volatility label | `Index.tsx` | REAL (frontend-computed) | Derived from `changePct` |

## What Was Removed

| Item | Was | Now |
|------|-----|-----|
| `src/data/mockMarketData.ts` (164 lines) | Hardcoded market data for 15 pairs + pair analyses for 6 pairs | Deleted |
| `src/data/mockSignals.ts` (262 lines) | Hardcoded signals, alerts, account stats, journal entries, market summary | Deleted |
| `src/data/` directory | Mock data container | Deleted |
| Dashboard `balance ?? 10000` | Showed fake $10K balance | Shows setup prompt |
| Dashboard `equity ?? 10000` | Showed fake $10K equity | Shows setup prompt |
| `getQualityForSignal()` | Read mock data synchronously | Replaced with `getQualityFromEnrichedSignal()` using DB data |

## What Was Kept (intentionally)

| Item | Why |
|------|-----|
| `DEFAULT_PIP_VALUES` in `pip-value.ts` | Safety net for momentary price unavailability. `isLive` flag communicates status. Calculator shows "est." |
| Frontend journal stats computation | Correct math on user's own DB data. Backend aggregation not needed yet |
| Frontend daily risk computation | Correct math on user's own open trades from DB |
