# PipPilot AI — Features Specification

---

## 1. Authentication

### Purpose
Secure user authentication with email verification and role-based access control.

### Flows
| Flow | Description |
|------|-------------|
| **Signup** | Email + password + display name. Triggers `handle_new_user` DB function which auto-creates profile, trading account, and risk profile. |
| **Login** | Email + password. Redirects to `/` (dashboard) or `/onboarding` if not completed. |
| **Email Verification** | Required before login is functional. Auto-confirm is **disabled**. |
| **Forgot Password** | Sends password reset email via Supabase Auth. |
| **Reset Password** | Token-based password update page. |
| **Onboarding** | Post-signup wizard to configure experience level, preferred pairs, sessions, risk parameters. |
| **Sign Out** | Clears session and redirects to login. |

### Data Dependencies
- `auth.users` (Supabase-managed)
- `profiles` table (auto-created on signup)
- `trading_accounts` table (auto-created on signup)
- `user_risk_profiles` table (auto-created on signup)
- `user_roles` table (manual admin assignment)

### UI Components
- `src/pages/Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Onboarding.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/contexts/AuthContext.tsx`

### Future Enhancements
- Google/GitHub OAuth
- Magic link authentication
- Session management UI
- Two-factor authentication

---

## 2. Dashboard

### Purpose
Central hub showing account status, active signals, alerts, market data, and journal performance at a glance.

### Sections & Inputs
| Section | Data Source | Hook |
|---------|-----------|------|
| Account Overview (5 stat cards) | `trading_accounts`, `user_risk_profiles` | `useTradingAccount()`, `useRiskProfile()` |
| Active Trade Ideas (table) | `signals` table (status=active, limit 6) | `useActiveSignals(6)` |
| Alerts Feed (list) | `alerts` table (limit 5) | `useDashboardAlerts(5)` |
| Market Watch Summary | Mock data + `user_watchlist` | `useDashboardWatchlist(6)`, `useMarketSummary()` |
| Journal Snapshot (stats + list) | `trade_journal_entries` | `useDashboardJournal(3)`, `useDashboardJournalStats()` |
| Trading Tip | Static array, rotated by day | Local state |

### Outputs
- Visual cards with balance, equity, daily P/L, risk used, risk remaining
- Clickable signal table rows linking to signal detail
- Alert list with severity icons and timestamps
- Market watch pairs with price, change %, volatility, sentiment
- Journal stats (total, win rate, avg P/L) and recent entries

### UI Components
- `src/pages/Index.tsx`
- `src/components/ui/stat-card.tsx`
- `src/components/ui/status-badge.tsx`

### Future Enhancements
- Real-time P/L tracking with open positions
- Equity curve chart
- Customizable widget layout
- Session-aware market status indicator

---

## 3. Market Watch (Watchlist)

### Purpose
Monitor all available forex instruments with market data, trend analysis, and signal indicators.

### Inputs
- Search query (pair name)
- Favorites filter (show only watchlisted pairs)
- Signal filter (has signal / no signal)
- Session filter (London / New York / Asia)
- Trend filter (bullish / bearish / neutral)
- Volatility filter (Low / Med / High)
- Add pair selector (from instruments table)

### Outputs
- Table with: star toggle, pair, price, spread, daily change %, volatility badge, session badge, trend arrows (H1/H4/D1), signal badge, news risk icon
- Click row → navigate to Pair Detail

### Data Dependencies
- `instruments` table (active instruments)
- `user_watchlist` table (user favorites)
- `signals` table (active signals for signal column)
- `mockMarketData` (price, spread, volatility, trends, sessions, levels)

### Hooks
- `useInstruments()`, `useWatchlist()`, `useAddToWatchlist()`, `useRemoveFromWatchlist()`, `useActiveSignals(100)`

### UI Components
- `src/pages/Watchlist.tsx`

### Future Enhancements
- Real-time price feeds via WebSocket
- Custom columns (user-selectable)
- Price alerts directly from watchlist
- Sortable columns

---

## 4. Pair Detail

### Purpose
Comprehensive analysis view for a single currency pair.

### Inputs
- URL parameter: `:pair` (e.g., `EUR/USD`)

### Outputs
- Price header with current price, change, spread
- Key levels card (support, resistance, session high/low, prev day high/low)
- Multi-timeframe trend indicators (H1, H4, D1)
- Market structure badge (trending / ranging / breakout)
- AI Analysis section with beginner and expert explanations
- Reasons For / Against bullet lists
- Active signals table for this pair
- Journal entries table for this pair
- Chart placeholder

### Data Dependencies
- `mockMarketData[pair]` — market data
- `mockPairAnalysis[pair]` — AI analysis
- `signals` table (filtered by pair)
- `trade_journal_entries` table (filtered by pair)

### Hooks
- `useSignalsByPair(pair)`, `useJournalByPair(pair)`

### UI Components
- `src/pages/PairDetail.tsx`

### Future Enhancements
- Live chart integration (TradingView widget or custom)
- Real-time price updates
- Historical performance for this pair
- Correlation analysis with other pairs

---

## 5. Signal Explorer

### Purpose
Browse, filter, and analyze all AI-generated trade signals.

### Inputs (Filters)
| Filter | Options |
|--------|---------|
| Search | Free-text pair search |
| Timeframe | All, 5m, 15m, 1H, 4H, D |
| Direction | All, Long, Short |
| Quality | All, A+, A, B, C |
| Confidence | All, 80%+, 60–79%, Below 60% |
| Status | All, active, monitoring, ready, triggered, invalidated, closed |

### Outputs
- Desktop: full table with all signal fields
- Mobile: card-based layout via `SignalCard` component
- Result count label
- Click row/card → opens `SignalDetailDrawer`

### Signal Detail Drawer Contents
- Full signal data (pair, direction, entry, SL, TP1/2/3, confidence, quality)
- AI reasoning (beginner + expert views)
- Reasons for / against
- Invalidation criteria
- Risk calculator pre-populated with signal's entry and SL

### Data Dependencies
- `signals` table (all signals)
- `mockPairAnalysis` (for quality grades and analysis data)

### Hooks
- `useSignals()` — fetches all signals, enriches with analysis data and R:R calculation

### UI Components
- `src/pages/Signals.tsx`
- `src/components/signals/SignalCard.tsx`
- `src/components/signals/SignalDetailDrawer.tsx`

### Future Enhancements
- Signal performance tracking (did TP1/TP2/TP3 get hit?)
- Signal alerts (notify when a signal status changes)
- Signal sharing
- Historical signal accuracy statistics

---

## 6. Risk Calculator

### Purpose
Calculate optimal position size based on account parameters and risk tolerance.

### Inputs
| Input | Type | Default |
|-------|------|---------|
| Account Balance | number | 10,000 |
| Account Equity | number | 10,000 |
| Account Currency | select | USD |
| Selected Pair | select | EUR/USD |
| Entry Price | number | 0 |
| Stop Loss (price) | number | 0 |
| Stop Loss (pips) | number | auto-calculated |
| Risk % per Trade | slider (0.1–10) | 1.0 |
| Fixed Risk Amount | number (optional) | — |
| Current Open Risk | number (optional) | — |
| Conservative Mode | toggle | OFF |

### Outputs
| Output | Calculation |
|--------|-------------|
| Max Risk ($) | `balance × (riskPct / 100)` or fixed amount |
| Lot Size | `riskAmount / (pipDistance × pipValue)` — halved if conservative |
| Pip Value | Currently fixed at $10/pip/lot (placeholder) |
| Exposure | `lotSize × 100,000` |

### Validation
- Balance must be positive
- Entry and SL must be positive and different
- Risk % must be between 0.1% and 10%

### Warnings
- Red: Total open risk > 5% of balance
- Yellow: Total open risk > 3% of balance
- Blue: Conservative mode active

### Data Dependencies
- `mockMarketData` — for pair list
- No DB dependency (standalone calculator)

### UI Components
- `src/components/calculator/RiskCalculator.tsx`
- `src/pages/CalculatorPage.tsx`

### Future Enhancements
- Real pip value calculation using live exchange rates
- Auto-populate from signal data
- Account-currency-aware conversions
- Leverage-aware calculations
- Multiple TP level partial close sizing

---

## 7. Alerts Center

### Purpose
View and manage trading alerts linked to signals and market conditions.

### Inputs
- Filter by: type, severity, status, pair, read/unread
- Actions: mark as read, mark all as read

### Outputs
- Alert list with: title, pair, severity badge, message/condition, timestamp, read indicator
- Grouped by read/unread status

### Data Dependencies
- `alerts` table (user's own alerts via RLS)

### Hooks
- `useAlerts()`, `useUnreadAlertCount()`, `useMarkAlertRead()`, `useMarkAllAlertsRead()`

### UI Components
- `src/pages/Alerts.tsx`

### Future Enhancements
- Custom alert creation (price level, indicator-based)
- Email / push / Telegram delivery
- Alert scheduling and expiration
- Sound notifications

---

## 8. Trade Journal

### Purpose
Log, track, and analyze personal trading performance.

### Inputs (Entry Form)
- Pair, direction, entry price, SL, TP, lot size
- Status (open/closed), exit price, result pips, result amount
- Confidence, setup type, setup reasoning
- Followed plan (boolean), emotional notes, lesson learned, screenshot URL

### Outputs
- Stats row: total trades, wins, win rate, avg pips, avg R, best pair, worst pair
- Filterable table with all journal entries
- Detail drawer for viewing/editing individual entries
- Empty state with CTA to add first entry

### Data Dependencies
- `trade_journal_entries` table

### Hooks
- `useJournalEntries()`, `useJournalStats()`, `useCreateJournalEntry()`, `useUpdateJournalEntry()`, `useDeleteJournalEntry()`

### UI Components
- `src/pages/Journal.tsx`
- `src/components/journal/JournalEntryForm.tsx`
- `src/components/journal/JournalDetailDrawer.tsx`
- `src/components/journal/JournalFilters.tsx`

### Future Enhancements
- Screenshot upload to cloud storage
- Chart annotations
- Performance analytics (equity curve, drawdown chart, monthly breakdown)
- AI-powered trade review and suggestions
- Export to CSV/PDF

---

## 9. Settings

### Purpose
Configure user profile, trading preferences, risk parameters, and notification settings.

### Sections
| Section | Fields |
|---------|--------|
| Profile | Display name, email (read-only), experience level, trading style |
| Trading Preferences | Default timeframe, preferred pairs (majors + minors), preferred sessions |
| Strategy Preferences | Toggle: Trend Pullback, Breakout Retest, Range Reversal, Momentum Breakout, S/R Rejection |
| Risk Preferences | Balance, equity, currency, broker name, default risk %, max daily loss %, conservative mode |
| Notifications | Enable/disable notifications, alert channels (in-app; email/push/Telegram coming soon) |
| Appearance | Timezone selector |

### Data Dependencies
- `profiles` table (read + update)
- `user_risk_profiles` table (conservative_mode field)

### UI Components
- `src/pages/SettingsPage.tsx`

### Future Enhancements
- Unsaved changes indicator
- Profile photo upload
- Theme switching (dark/light)
- Account deletion
- Data export

---

## 10. Admin Review

### Purpose
Admin-only panel for reviewing AI-generated signals and alerts to improve quality.

### Access Control
- Requires `admin` role in `user_roles` table
- Checked via `useIsAdmin()` hook using `has_role()` DB function

### Features
- Two tabs: Signals Review, Alerts Review
- Filter by: pair, status, setup type, review tag
- Review stats: total, reviewed %, good signals %, false positive %, average confidence
- Tagging: good_signal, false_positive, needs_review, or clear tag
- Review notes (free text)
- Timestamps and reviewer attribution

### Data Dependencies
- `signals` table (admin has ALL access via RLS)
- `alerts` table (admin has ALL access via RLS)
- `user_roles` table

### Hooks
- `useIsAdmin()`, `useAdminSignals()`, `useAdminAlerts()`, `useReviewSignal()`, `useReviewAlert()`, `useSignalReviewStats()`

### UI Components
- `src/pages/AdminReview.tsx`
- `src/components/admin/ReviewTagSelect.tsx`
- `src/components/admin/ReviewNotesPopover.tsx`

### Future Enhancements
- Bulk review actions
- Signal accuracy tracking over time
- Automated quality scoring
- Review workflow with approval stages
