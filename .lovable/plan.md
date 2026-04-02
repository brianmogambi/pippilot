

# Phase 9 — Alerts Center Rebuild

## Current state
- Basic alerts list page with pending/triggered/expired status display
- DB `alerts` table has: id, user_id, signal_id, pair, condition, status, type, title, message, severity, is_read, created_at, triggered_at
- Missing: `timeframe` column in alerts table
- No mark-as-read functionality, no filters, no link to related signal

## Plan

### 1. Database migration
Add `timeframe` column to `alerts` table (nullable text, default null) so alerts can reference the timeframe context.

### 2. Seed sample alerts
Insert ~8 sample alerts covering the 10 alert types (setup_forming, entry_zone_reached, confirmation_detected, move_sl_breakeven, take_partial, take_full_exit, setup_invalidated, volatility_spike, news_risk, over_risk) with varying severities and read/unread states, linked to the existing EUR/USD signal.

### 3. Rebuild `src/pages/Alerts.tsx`

**Header section**: Title "Alert Center", subtitle, unread count badge.

**Action bar**: 
- "Mark All Read" button (updates all user's unread alerts via supabase)
- Filter row: Type (multi-select or dropdown), Severity (all/info/warning/critical), Read state (all/unread/read), Pair filter

**Alert list**: Each alert card shows:
- Type icon (mapped per alert type with distinct icons)
- Severity indicator (color-coded left border: blue=info, amber=warning, red=critical)
- Title, pair + timeframe badges, short message
- Relative timestamp ("2m ago", "1h ago")
- Unread dot indicator
- "Mark Read" button per alert
- "View Signal" button if signal_id exists (navigates to /signals and could open drawer)

**States**: Loading skeletons, empty state, no-match filter state.

**Data**: Query `alerts` table, refetch on mutations via queryClient invalidation.

### 4. Notification preferences card (bottom section)
A collapsible card at the bottom of the Alerts page showing current notification preferences with a link to Settings. Shows toggle states for future channels (In-App, Email, Push, Telegram) with "Coming Soon" badges on Email/Push/Telegram. In-App reads from profile `notifications_enabled`.

### Files to modify
- `src/pages/Alerts.tsx` — full rebuild

### Database changes
- Migration: add `timeframe` text column to `alerts`
- Seed: insert sample alert data

### No route changes needed

