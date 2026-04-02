

# Phase 5 — Watchlist Page Rebuild

## Current state
`Watchlist.tsx` is a basic page: select a pair from instruments, add/remove from `user_watchlist`, display in a simple 3-column table (Pair, Added, Delete). No mock market data, no filters, no pair detail navigation.

## What changes

Full rebuild of `src/pages/Watchlist.tsx` into a professional market watch screen, plus a new `PairDetail` page.

### 1. Mock market data layer
Create `src/data/mockMarketData.ts` — a lookup map keyed by symbol providing:
- `price`, `spread`, `dailyChange`, `dailyChangePct`
- `atr` (placeholder numeric), `volatility` ("Low"/"Med"/"High")
- `trendH1`, `trendH4`, `trendD1` ("bullish"/"bearish"/"neutral")
- `activeSession` ("London"/"New York"/"Asia"/"Closed")
- `newsRisk` (boolean — upcoming high-impact news flag)
- Covers all seeded instruments (~15 pairs)

### 2. Watchlist page rebuild (`src/pages/Watchlist.tsx`)
**Header area:**
- Title + subtitle
- Search input (filters table by pair name)
- Add pair dropdown + button (existing logic, retained)

**Filter bar:**
- Favorites only toggle (show only `user_watchlist` pairs vs all instruments)
- Signal status filter: All / Active Signal / No Signal
- Session filter: All / London / New York / Asia
- Trend direction: All / Bullish / Bearish / Neutral (based on H4 trend)
- Volatility: All / Low / Med / High
- Implemented as a row of small `Select` dropdowns

**Table columns:**
- Star icon (favorite/unfavorite — toggles `user_watchlist` membership)
- Pair name
- Price (from mock data)
- Spread (mock)
- Daily Change + Change % (color-coded)
- ATR / Volatility badge (Low/Med/High with StatusBadge)
- Session status badge
- Trend summary (H1/H4/D1 arrows or badges, compact)
- Signal status badge (cross-reference active signals from DB)
- News risk flag icon (warning triangle if `newsRisk` is true)
- Row is clickable → navigates to `/watchlist/:pair`

**Data flow:**
- Query `instruments` for full pair list
- Query `user_watchlist` for favorites
- Query `signals` (active) for signal status cross-reference
- Merge with mock market data map
- Apply filters client-side

**States:** Loading skeleton rows, empty state when no instruments match filters.

### 3. Pair Detail page (`src/pages/PairDetail.tsx`)
A dedicated page at `/watchlist/:pair` showing:
- Pair name + favorite toggle
- Price, spread, daily change (from mock data)
- Trend summary cards (H1, H4, D1 — each with direction badge)
- Volatility / ATR card
- Session status
- News risk indicator
- Active signals for this pair (query `signals` filtered by pair)
- Recent journal entries for this pair
- Placeholder chart area (empty card with "Chart coming soon")
- Back link to watchlist

### 4. Route addition
Add `/watchlist/:pair` route in `App.tsx` pointing to `PairDetail`.

---

## Files to create
- `src/data/mockMarketData.ts` — mock price/spread/ATR/trend/session/news data
- `src/pages/PairDetail.tsx` — pair detail view

## Files to modify
- `src/pages/Watchlist.tsx` — full rebuild with filters, rich table, search
- `src/App.tsx` — add PairDetail route

## No database changes needed
All data comes from existing tables (`instruments`, `user_watchlist`, `signals`, `trade_journal_entries`) plus mock market data.

