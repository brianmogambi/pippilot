# Frontend-to-Backend Gap Analysis

> Generated 2026-04-08. Documents gaps between what the frontend expects and what the backend provides.

## Critical Gaps

### 1. Market Data Depends on Edge Function Execution
- **Frontend:** `useAllMarketData()` queries `market_data_cache` — returns `null` if empty
- **Backend:** Table is only populated when `fetch-market-data` Edge Function runs
- **Impact:** Watchlist shows "—" for all prices, Dashboard market watch is empty, PairDetail shows "Market data unavailable"
- **Fix needed:** Ensure `fetch-market-data` runs on a schedule (cron) or on first login

### 2. Pair Analysis Depends on Signal Generation
- **Frontend:** `usePairAnalysis()` queries `pair_analyses` — returns `null` if empty
- **Backend:** Table is only populated when `generate-signals` Edge Function runs (8 batches for 16 pairs)
- **Impact:** PairDetail shows "No setup analysis available", signal enrichment has no analysis
- **Fix needed:** Ensure `generate-signals` runs on a schedule after market data is populated

### 3. Dashboard Account Shows Setup Prompt for New Users
- **Frontend:** Shows "Set up your trading account" when balance is 0
- **Backend:** `handle_new_user()` trigger creates `trading_accounts` with default values on signup
- **Gap:** The trigger may set balance to 0 or a default — user needs to configure via Settings
- **Status:** This is now honest behavior (no fake $10K)

### 4. Pip Values Use Static Fallback When Market Data Stale
- **Frontend:** `usePipValue()` calculates from live prices, falls back to `DEFAULT_PIP_VALUES`
- **Backend:** Prices come from `market_data_cache` which updates every ~5 min
- **Impact:** If cache is empty, pip values use early-2026 static rates (could diverge from reality)
- **Mitigation:** Calculator shows "est." label; `isLive` flag available to any consumer

### 5. Daily Risk is Frontend-Computed
- **Frontend:** `useDailyRiskUsed()` queries open journal entries, computes `riskUsedPct` from pip distance * pip value * lot size
- **Backend:** No server-side risk validation or enforcement
- **Impact:** Risk is only as accurate as the user's journal entries; no real-time broker integration
- **Status:** Acceptable for current scope — user-entered trade data

### 6. Journal Stats are Frontend-Computed
- **Frontend:** `useJournalStats()` computes win rate, avg pips, avg R, best/worst pair from journal entries
- **Backend:** No materialized aggregations or views
- **Impact:** Computed on every render (mitigated by `useMemo`). Could become slow with thousands of entries
- **Status:** Acceptable for current scope

## Non-Gaps (Things That Work End-to-End)

| Feature | Frontend Hook | Backend Table | Status |
|---------|--------------|---------------|--------|
| Auth & profiles | `AuthContext` | `profiles` + auth trigger | Working |
| Trading account CRUD | `useTradingAccount()` | `trading_accounts` | Working |
| Risk profile CRUD | `useRiskProfile()` | `user_risk_profiles` | Working |
| Signal list/detail | `useSignals()`, `useActiveSignals()` | `signals` | Working (when EF runs) |
| Journal CRUD | `useJournalEntries()` | `trade_journal_entries` | Working |
| Alerts CRUD | `useAlerts()` | `alerts` | Working |
| Watchlist CRUD | `useWatchlist()` | `user_watchlist` | Working |
| Instruments list | `useInstruments()` | `instruments` | Working (seeded) |
| Admin review | `useAdminSignals()` | `signals` + `user_roles` | Working |

## Recommended Next Steps

1. **Schedule Edge Functions** — Set up cron triggers for `fetch-market-data` (every 5 min during market hours) and `generate-signals` (every 1-4 hours) to ensure data is always populated
2. **First-login data seed** — Consider triggering a market data fetch on first authenticated page load if `market_data_cache` is empty
3. **Loading states** — Pages now show empty states instead of mock data. Consider adding skeleton loaders or "data syncing..." indicators to communicate that data is expected but not yet available
