

# Phase 4 — Premium Dashboard Rebuild

## Current state
The Dashboard (`Index.tsx`) already queries `trading_accounts`, `user_risk_profiles`, `signals`, `alerts`, and `trade_journal_entries` from the database. It uses `mockMarketSummary` for market watch. The layout has stat cards, signal cards, alerts list, watchlist, journal, and a disclaimer. It works but lacks the requested sections (daily P/L, risk remaining, volatility badges, beginner insight card, signal table view, severity/unread indicators on alerts, journal performance summary).

## What changes

Rebuild `src/pages/Index.tsx` with 6 distinct sections in a premium card-based layout:

### 1. Account Overview (top row — 5 stat cards)
- Balance, Equity, Daily P/L (placeholder: equity - balance), Risk Used Today (placeholder 0%), Remaining Daily Risk (max_daily_loss_pct - used)
- Enhance `StatCard` to support a `variant` prop for subtle background tints (e.g. warning when risk is high)

### 2. Market Watch Summary
- Uses user's watchlist pairs from `user_watchlist` table, falls back to `mockMarketSummary` for prices
- Each pair card shows: pair name, price (mock), trend badge (bullish/bearish/neutral from mock data), volatility badge (placeholder: "Low"/"Med"/"High" derived from changePct), signal status badge (cross-reference active signals)
- Compact horizontal scrollable row or grid

### 3. Active Trade Ideas (table-style card)
- Query active signals, display as a compact table with columns: Pair, Direction, Setup Type, Entry, SL, TP1, Confidence bar, Status badge
- Empty state: "No active trade ideas. Check back soon."
- Link to /signals

### 4. Alerts Feed
- Query alerts ordered by created_at desc, limit 5
- Show: severity icon (color-coded info/warning/critical), title or pair, message, timestamp (relative), unread dot indicator (`is_read` field)
- Empty state: "All clear — no alerts."

### 5. Journal Snapshot
- Last 3 journal entries (already queried)
- Add a mini performance summary row above: Total Trades, Win Rate, Avg P/L (computed from all journal entries via a separate query)
- Empty state: "Start logging trades to track your performance."

### 6. Beginner Insight Card (new)
- A visually distinct card with a lightbulb icon
- Rotating educational tips (hardcoded array, pick one based on day)
- Example: "A good trade setup needs structure, confirmation, and acceptable risk."
- Subtle gradient border, different from other cards

### Files to modify
- `src/pages/Index.tsx` — full rebuild with the 6 sections above
- `src/components/ui/stat-card.tsx` — add optional `variant` prop for tinted backgrounds

### Files to create
- None needed — all sections go directly in Index.tsx using existing components (StatCard, StatusBadge, SignalCard or inline table)

### No database changes needed
All required tables and fields already exist. Mock market data stays for V1.

