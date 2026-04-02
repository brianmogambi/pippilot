

# Phase 3 — Database Schema Expansion

## Current state
Five tables exist: `profiles` (with onboarding fields), `signals`, `alerts`, `user_watchlist`, `user_roles`. Pages use mock data for journal, watchlist prices, and market summary.

## Approach
Rather than replacing everything, we evolve the existing schema — add new tables where needed, expand existing ones, and keep what works. Some requested entities (e.g. `notification_preferences`, `strategy_preferences`) are already covered by columns in `profiles` and don't need separate tables at MVP scale.

---

## Migration plan (single SQL migration)

### 1. New table: `trading_accounts`
Separates account financials from profile preferences.
- `id`, `user_id`, `account_name` (default 'Primary'), `account_currency`, `balance`, `equity`, `leverage` (nullable), `broker_name` (nullable), `is_default` (boolean, default true), `created_at`, `updated_at`
- RLS: users CRUD own rows

### 2. New table: `user_risk_profiles`
Dedicated risk management settings per user.
- `id`, `user_id` (unique — one per user), `risk_per_trade_pct`, `max_daily_loss_pct`, `max_total_open_risk_pct` (default 10), `conservative_mode` (boolean, default false), `created_at`, `updated_at`
- RLS: users CRUD own row

### 3. New table: `instruments`
Reference table of tradeable pairs.
- `id`, `symbol` (unique, e.g. "EUR/USD"), `base_currency`, `quote_currency`, `instrument_type` (default 'forex'), `pip_value` (numeric), `is_active` (boolean, default true), `created_at`
- RLS: all authenticated can SELECT; admins can INSERT/UPDATE

### 4. New table: `trade_journal_entries`
Full journal with result tracking.
- `id`, `user_id`, `pair`, `direction`, `entry_price`, `exit_price` (nullable), `stop_loss` (nullable), `take_profit` (nullable), `result_pips` (nullable), `result_amount` (nullable), `lot_size` (nullable), `notes` (nullable), `followed_plan` (boolean, default true), `status` ('open'/'closed', default 'open'), `opened_at`, `closed_at` (nullable), `created_at`, `updated_at`
- RLS: users CRUD own rows

### 5. Expand `signals` table → add setup fields
Add columns to existing `signals`:
- `take_profit_3` (numeric, nullable)
- `setup_type` (text, nullable — e.g. 'breakout', 'reversal', 'continuation')
- `invalidation_reason` (text, nullable)
- `created_by_ai` (boolean, default true)
- `updated_at` (timestamptz, default now())

### 6. Expand `alerts` table → richer notifications
Add columns to existing `alerts`:
- `type` (text, default 'price' — price/signal/risk/system)
- `title` (text, nullable)
- `message` (text, nullable)
- `severity` (text, default 'info' — info/warning/critical)
- `is_read` (boolean, default false)

### 7. Seed `instruments` table
Insert major and minor forex pairs (~15 instruments) with correct pip values.

### 8. Auto-create risk profile on signup
Update the `handle_new_user()` trigger function to also create a `user_risk_profiles` row and a default `trading_accounts` row, pulling defaults from the profile's onboarding data.

---

## Code changes

### Files to modify
- **`src/pages/Journal.tsx`** — Query `trade_journal_entries` from DB instead of mock data; wire "Add Entry" button to an insert form/dialog
- **`src/pages/Alerts.tsx`** — Query `alerts` from DB; use new `title`, `message`, `severity`, `is_read` fields
- **`src/pages/Watchlist.tsx`** — Query `user_watchlist` from DB; add/remove pairs with real mutations
- **`src/pages/Index.tsx`** — Pull account stats from `trading_accounts` + `user_risk_profiles` via AuthContext or direct queries
- **`src/contexts/AuthContext.tsx`** — Optionally expose `tradingAccount` and `riskProfile` alongside `profile`
- **`src/components/layout/AppHeader.tsx`** — Use real balance/equity from trading account

### Files to create
- **`src/components/journal/JournalEntryForm.tsx`** — Dialog form for adding/editing journal entries

## What stays the same
- `profiles` table keeps its current columns (display_name, experience_level, trading_style, preferred_pairs, preferred_sessions, timezone, notifications_enabled, onboarding_completed) — these serve as strategy/notification preferences without needing separate tables
- `user_roles` — unchanged
- Auth flow, onboarding, settings — unchanged
- Mock market summary data stays (no live price feed in V1)

