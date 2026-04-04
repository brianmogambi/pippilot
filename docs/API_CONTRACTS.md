# PipPilot AI — API Contracts

PipPilot AI uses Supabase client-side queries (via `@supabase/supabase-js`) rather than custom REST endpoints. All operations go through the Supabase PostgREST layer with RLS enforcing access control.

This document defines the query contracts as they exist in the codebase, structured for Claude Code or any developer building backend extensions.

---

## Authentication

Authentication uses Supabase Auth directly.

### Sign Up
```typescript
supabase.auth.signUp({
  email: string,
  password: string,
  options: { data: { display_name: string } }
})
// Response: { data: { user, session }, error }
// Side effect: handle_new_user trigger creates profile, trading_account, risk_profile
```

### Sign In
```typescript
supabase.auth.signInWithPassword({ email: string, password: string })
// Response: { data: { user, session }, error }
```

### Sign Out
```typescript
supabase.auth.signOut()
```

### Reset Password (Request)
```typescript
supabase.auth.resetPasswordForEmail(email, { redirectTo: string })
```

### Reset Password (Update)
```typescript
supabase.auth.updateUser({ password: string })
```

### Get Session
```typescript
supabase.auth.getSession()
// Response: { data: { session }, error }
```

### Auth State Listener
```typescript
supabase.auth.onAuthStateChange((event, session) => { ... })
```

---

## Profiles

### Get User Profile
```typescript
// Hook: useAuth() → fetchProfile()
supabase
  .from("profiles")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle()
// Returns: Profile | null
```

### Update Profile
```typescript
// Hook: Settings page handleSave()
supabase
  .from("profiles")
  .update({
    display_name, experience_level, trading_style,
    default_timeframe, account_currency, broker_name,
    account_size, account_equity, default_risk_pct,
    max_daily_loss_pct, preferred_pairs, preferred_sessions,
    preferred_strategies, notifications_enabled, alert_channels,
    timezone
  })
  .eq("user_id", userId)
```

---

## Trading Accounts

### Get Default Account
```typescript
// Hook: useTradingAccount()
supabase
  .from("trading_accounts")
  .select("*")
  .eq("is_default", true)
  .maybeSingle()
// Returns: TradingAccount | null
```

---

## User Risk Profiles

### Get Risk Profile
```typescript
// Hook: useRiskProfile()
supabase
  .from("user_risk_profiles")
  .select("*")
  .maybeSingle()
// Returns: UserRiskProfile | null
```

### Update Risk Profile
```typescript
supabase
  .from("user_risk_profiles")
  .update({ conservative_mode: boolean })
  .eq("user_id", userId)
```

---

## Signals

### Get All Signals (ordered by newest)
```typescript
// Hook: useSignals()
supabase
  .from("signals")
  .select("*")
  .order("created_at", { ascending: false })
// Returns: Signal[]
```

### Get Active Signals (with limit)
```typescript
// Hook: useActiveSignals(limit)
supabase
  .from("signals")
  .select("*")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(limit)
// Returns: Signal[]
```

### Get Signals by Pair
```typescript
// Hook: useSignalsByPair(pair)
supabase
  .from("signals")
  .select("*")
  .eq("pair", pair)
  .eq("status", "active")
// Returns: Signal[]
```

### Get Admin Signals (with filters)
```typescript
// Hook: useAdminSignals(filters)
let q = supabase.from("signals").select("*").order("created_at", { ascending: false });
if (filters.pair) q = q.eq("pair", filters.pair);
if (filters.status) q = q.eq("status", filters.status);
if (filters.setupType) q = q.eq("setup_type", filters.setupType);
if (filters.reviewTag === "unreviewed") q = q.is("review_tag", null);
else if (filters.reviewTag) q = q.eq("review_tag", filters.reviewTag);
// Returns: Signal[]
```

### Review Signal (Admin)
```typescript
// Hook: useReviewSignal()
supabase
  .from("signals")
  .update({
    review_tag: string | null,
    review_notes: string | null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId
  })
  .eq("id", signalId)
```

---

## Alerts

### Get All Alerts
```typescript
// Hook: useAlerts()
supabase
  .from("alerts")
  .select("*")
  .order("created_at", { ascending: false })
// Returns: Alert[]
```

### Get Dashboard Alerts (limited)
```typescript
// Hook: useDashboardAlerts(limit)
supabase
  .from("alerts")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(limit)
// Returns: Alert[]
```

### Get Unread Alert Count
```typescript
// Hook: useUnreadAlertCount()
supabase
  .from("alerts")
  .select("id", { count: "exact", head: true })
  .eq("is_read", false)
// Returns: number
```

### Mark Alert as Read
```typescript
// Hook: useMarkAlertRead()
supabase
  .from("alerts")
  .update({ is_read: true })
  .eq("id", alertId)
```

### Mark All Alerts as Read
```typescript
// Hook: useMarkAllAlertsRead()
supabase
  .from("alerts")
  .update({ is_read: true })
  .eq("user_id", userId)
  .eq("is_read", false)
```

### Review Alert (Admin)
```typescript
// Hook: useReviewAlert()
supabase
  .from("alerts")
  .update({
    review_tag, review_notes,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId
  })
  .eq("id", alertId)
```

---

## Watchlist

### Get User Watchlist
```typescript
// Hook: useWatchlist()
supabase
  .from("user_watchlist")
  .select("*")
  .order("created_at", { ascending: false })
// Returns: { id, user_id, pair, created_at }[]
```

### Get Dashboard Watchlist (pairs only, limited)
```typescript
// Hook: useDashboardWatchlist(limit)
supabase
  .from("user_watchlist")
  .select("pair")
  .limit(limit)
// Returns: { pair: string }[]
```

### Add to Watchlist
```typescript
// Hook: useAddToWatchlist()
supabase
  .from("user_watchlist")
  .insert({ user_id: userId, pair: string })
```

### Remove from Watchlist
```typescript
// Hook: useRemoveFromWatchlist()
supabase
  .from("user_watchlist")
  .delete()
  .eq("user_id", userId)
  .eq("pair", pair)
```

---

## Instruments

### Get Active Instruments
```typescript
// Hook: useInstruments()
supabase
  .from("instruments")
  .select("symbol")
  .eq("is_active", true)
  .order("symbol")
// Returns: { symbol: string }[]
```

---

## Trade Journal

### Get All Entries
```typescript
// Hook: useJournalEntries()
supabase
  .from("trade_journal_entries")
  .select("*")
  .order("created_at", { ascending: false })
// Returns: JournalEntry[]
```

### Get Dashboard Journal (limited)
```typescript
// Hook: useDashboardJournal(limit)
supabase
  .from("trade_journal_entries")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(limit)
// Returns: JournalEntry[]
```

### Get Dashboard Journal Stats
```typescript
// Hook: useDashboardJournalStats()
supabase
  .from("trade_journal_entries")
  .select("result_pips, status")
// Computed client-side: { total, winRate, avgPL }
```

### Get Entries by Pair
```typescript
// Hook: useJournalByPair(pair, limit)
supabase
  .from("trade_journal_entries")
  .select("*")
  .eq("pair", pair)
  .order("opened_at", { ascending: false })
  .limit(limit)
// Returns: JournalEntry[]
```

### Create Entry
```typescript
// Hook: useCreateJournalEntry()
supabase
  .from("trade_journal_entries")
  .insert({
    user_id, pair, direction, entry_price,
    stop_loss?, take_profit?, lot_size?,
    status?, confidence?, setup_type?,
    setup_reasoning?, notes?, emotional_notes?
  })
```

### Update Entry
```typescript
// Hook: useUpdateJournalEntry()
supabase
  .from("trade_journal_entries")
  .update({ ...fields })
  .eq("id", entryId)
```

### Delete Entry
```typescript
// Hook: useDeleteJournalEntry()
supabase
  .from("trade_journal_entries")
  .delete()
  .eq("id", entryId)
```

---

## User Roles

### Check Admin Status
```typescript
// Hook: useIsAdmin()
supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "admin")
  .maybeSingle()
// Returns: truthy if admin
```

---

## Query Key Conventions

All queries use TanStack React Query with the following key patterns:

| Query Key | Hook |
|-----------|------|
| `["signals"]` | `useSignals()` |
| `["signals-active", limit]` | `useActiveSignals(limit)` |
| `["signals-pair", pair]` | `useSignalsByPair(pair)` |
| `["alerts", userId]` | `useAlerts()` |
| `["dashboard-alerts", userId]` | `useDashboardAlerts()` |
| `["unread-alerts", userId]` | `useUnreadAlertCount()` |
| `["watchlist", userId]` | `useWatchlist()` |
| `["dashboard-watchlist", userId]` | `useDashboardWatchlist()` |
| `["instruments"]` | `useInstruments()` |
| `["trading-account", userId]` | `useTradingAccount()` |
| `["risk-profile", userId]` | `useRiskProfile()` |
| `["journal-entries", userId]` | `useJournalEntries()` |
| `["journal-stats", userId]` | `useDashboardJournalStats()` |
| `["journal-pair", pair]` | `useJournalByPair()` |
| `["dashboard-journal", userId]` | `useDashboardJournal()` |
| `["is-admin", userId]` | `useIsAdmin()` |
| `["admin-signals", filters]` | `useAdminSignals()` |
| `["admin-alerts", filters]` | `useAdminAlerts()` |
