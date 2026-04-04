

# Phase 13 — Backend Integration Points

## Problem

Data-fetching logic is scattered across page components with inline `useQuery` calls and direct Supabase imports. Mock data types are duplicated (e.g., `Signal` in `mockSignals.ts` vs `DbSignal` in `Signals.tsx` vs auto-generated types in `types.ts`). This makes it hard to swap mock data for real APIs later.

## Approach

Create a clean service layer: **shared types** → **data hooks** → **pages consume hooks**. Pages will import hooks instead of calling Supabase directly. Mock data files remain but are only consumed through the hooks, making them trivial to replace.

## Files to create

### 1. `src/types/trading.ts` — Canonical domain types

Single source of truth for all domain interfaces. Derives from Supabase auto-generated types where possible, adds computed/enriched fields separately.

```text
- Signal (from DB Row + computed riskReward)
- Alert (from DB Row)  
- JournalEntry (from DB Row)
- TradingAccount (from DB Row)
- UserRiskProfile (from DB Row)
- Instrument (from DB Row)
- InstrumentSnapshot (market data — currently mock-only)
- PairAnalysis (setup analysis — currently mock-only)
- MarketSummary (dashboard market cards)
```

### 2. `src/hooks/use-signals.ts`
- `useSignals(filters?)` — replaces inline query in Signals.tsx
- `useActiveSignals(limit?)` — replaces inline query in Index.tsx
- Enrichment logic (riskReward calc, pair analysis merge) stays here

### 3. `src/hooks/use-alerts.ts`
- `useAlerts(filters?)` — replaces inline query in Alerts.tsx
- `useMarkAlertRead()` — mutation
- `useMarkAllAlertsRead()` — mutation
- `useUnreadAlertCount()` — replaces inline query in AppHeader.tsx

### 4. `src/hooks/use-journal.ts`
- `useJournalEntries()` — replaces inline query in Journal.tsx
- `useCreateJournalEntry()` — mutation (from JournalEntryForm)
- `useUpdateJournalEntry()` — mutation
- `useDeleteJournalEntry()` — mutation
- `useJournalStats()` — derived computed stats (win rate, avg R, best/worst pair)

### 5. `src/hooks/use-account.ts`
- `useTradingAccount()` — replaces inline queries in Index.tsx, AppHeader.tsx
- `useRiskProfile()` — replaces inline query in Index.tsx, SettingsPage.tsx

### 6. `src/hooks/use-watchlist.ts`
- `useWatchlist()` — replaces inline query in Watchlist.tsx
- `useAddToWatchlist()` — mutation
- `useRemoveFromWatchlist()` — mutation
- `useInstruments()` — replaces inline query in Watchlist.tsx

### 7. `src/hooks/use-market-data.ts`
- `useMarketData(symbol)` — wraps `getMarketData()` with a hook interface
- `usePairAnalysis(symbol)` — wraps `getPairAnalysis()`
- `useMarketSummary()` — wraps `mockMarketSummary`
- These are the primary swap points: when a real market data API is integrated, only these hooks change

## Files to modify

- `src/pages/Index.tsx` — replace 4 inline queries with hook calls
- `src/pages/Signals.tsx` — replace query + enrichment with `useSignals()`; remove local `DbSignal`/`EnrichedSignal` types
- `src/pages/Alerts.tsx` — replace query + mutations with hook calls; remove local `Alert` type
- `src/pages/Journal.tsx` — replace query with `useJournalEntries()` + `useJournalStats()`
- `src/pages/Watchlist.tsx` — replace queries/mutations with hook calls
- `src/pages/PairDetail.tsx` — use `useMarketData()` / `usePairAnalysis()`
- `src/components/layout/AppHeader.tsx` — use `useTradingAccount()` + `useUnreadAlertCount()`
- `src/components/journal/JournalEntryForm.tsx` — use mutation hooks
- `src/components/journal/JournalDetailDrawer.tsx` — use mutation hooks

## What stays the same

- All UI components, layouts, and styling remain untouched
- Mock data files (`mockMarketData.ts`, `mockSignals.ts`) remain as data sources consumed by hooks
- Supabase client import stays in hooks only (not in pages)
- `react-query` cache keys and invalidation patterns preserved

## Result

After this refactor, connecting a real backend (e.g., Claude-built signal engine) means editing only the hook files — pages and components never need to change.

