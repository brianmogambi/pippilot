

# Phase 11 — Settings & Preferences Rebuild

## Database changes

**Migration**: Add 3 new columns to `profiles` table:
- `default_timeframe` text nullable default `'H1'` — preferred chart timeframe
- `preferred_strategies` text[] nullable default `'{}'` — list of enabled strategy types
- `alert_channels` text[] nullable default `'{"in_app"}'` — notification channel preferences

These store strategy and alert channel preferences so they can later influence signal generation and alert routing.

## UI rebuild — `src/pages/SettingsPage.tsx`

Replace the current 5-tab layout with a **6-section vertical scroll layout** (no tabs — all sections visible, grouped in cards). This is cleaner for settings pages with many fields and avoids hiding content behind tabs.

### Section 1: Profile
- Display name, email (read-only), experience level (beginner/intermediate/advanced with inline descriptions), trading style

### Section 2: Trading Preferences
- Default timeframe select (M5, M15, H1, H4, D1)
- Preferred pairs (toggle chips, grouped Major/Minor)
- Preferred sessions (checkboxes with descriptions)

### Section 3: Strategy Preferences (NEW)
- Toggle switches for each strategy with beginner-friendly descriptions:
  - Trend Pullback — "Enter trends during temporary retracements"
  - Breakout Retest — "Trade breakouts after price retests the level"
  - Range Reversal — "Fade moves at range boundaries"
  - Momentum Breakout — "Catch strong directional moves"
  - S/R Rejection — "Trade bounces off key support/resistance"

### Section 4: Risk Preferences
- Account balance, equity, currency, broker
- Default risk %, max daily loss %
- Conservative mode toggle (reads/writes `user_risk_profiles`)

### Section 5: Notification Preferences
- In-app notifications toggle
- Alert channel checkboxes: In-App (active), Email (coming soon), Push (coming soon), Telegram (coming soon)
- Per-type alert toggles (setup forming, entry zone, volatility spike, etc.) — future placeholder section

### Section 6: Appearance
- Timezone select
- Theme (dark default, "coming soon" note)

### Save behavior
Single "Save Settings" button at bottom. Updates `profiles` table (and `user_risk_profiles` for conservative mode). Toast on success/error.

## Files to modify
- `src/pages/SettingsPage.tsx` — full rebuild
- Database migration — add 3 columns to `profiles`
- `src/contexts/AuthContext.tsx` — add new fields to Profile interface

