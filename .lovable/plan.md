

# Phase 1 — Enhanced App Shell & Navigation

## What exists
- Auth pages (Login, Signup, ForgotPassword, ResetPassword) — working
- Basic sidebar + mobile nav with 5 routes (Dashboard, Signals, Calculator, Alerts, Settings)
- Dashboard with stats cards, recent signals, watchlist
- Signals page with filters, SignalDetail page
- Calculator, Alerts, Settings pages — basic implementations
- Mock data in `mockSignals.ts`
- Dark theme configured

## What's new / changing
Two new pages (**Watchlist**, **Trade Journal**) and a **top header bar** with page title, account summary, and notifications. The Dashboard gets expanded mock widgets. All pages get a premium fintech polish pass.

---

## Plan

### 1. Add top header component
Create `src/components/layout/AppHeader.tsx`:
- Displays current page title (derived from route)
- Right side: account summary chip (balance + equity), notification bell icon with badge count, user avatar/initials dropdown
- Sticky, blends with dark theme

### 2. Update AppLayout
- Insert `<AppHeader />` above `<Outlet />`
- Structure: sidebar left, header + content right

### 3. Expand mock data
Add to `src/data/mockSignals.ts`:
- `mockAccountStats` — balance, equity, margin, daily P&L, daily risk used
- `mockJournalEntries` — id, pair, direction, entry/exit price, result, notes, date
- `mockMarketSummary` — major pairs with sentiment/change data
- `mockNotifications` — id, message, read, timestamp

### 4. New page: Watchlist (`/watchlist`)
Create `src/pages/Watchlist.tsx`:
- Table of watched pairs with columns: pair, current price (mock), daily change, signal status, actions (remove)
- Add-pair input/button
- Uses existing `watchlistPairs` data expanded with price mock data

### 5. New page: Trade Journal (`/journal`)
Create `src/pages/Journal.tsx`:
- Table of past trades: date, pair, direction, entry, exit, P&L, notes
- Summary stats row at top (total trades, win rate, avg R:R)
- "Add Entry" button (opens a form or placeholder)
- Uses `mockJournalEntries`

### 6. Enhanced Dashboard
Rebuild `src/pages/Index.tsx` with a richer widget grid:
- **Row 1**: Account Balance, Equity, Daily P&L, Daily Risk Status (4 stat cards)
- **Row 2 left (2/3)**: Active Setups (signal cards), Latest Alerts (3 most recent)
- **Row 2 right (1/3)**: Watchlist Summary (compact list), Recent Journal (last 3 entries)
- **Row 3**: Market Summary panel (major pairs grid with sentiment badges)
- Risk disclaimer banner at bottom

### 7. Update sidebar & mobile nav
- Add Watchlist (Eye icon) and Trade Journal (BookOpen icon) to nav items
- Update routes in `App.tsx`
- Sidebar order: Dashboard, Watchlist, Signals, Calculator, Alerts, Journal, Settings

### 8. Reusable components
- `src/components/ui/stat-card.tsx` — icon, label, value, optional trend indicator
- `src/components/ui/status-badge.tsx` — colored badge for signal status, alert status, sentiment

### 9. Disclaimer labels
Add visible labels throughout:
- Header: small "AI-Assisted Analysis" badge
- Dashboard footer: risk disclaimer card
- Signal cards: "Not financial advice" fine print
- Calculator: "Trading carries risk" note

### Files to create
- `src/components/layout/AppHeader.tsx`
- `src/pages/Watchlist.tsx`
- `src/pages/Journal.tsx`
- `src/components/ui/stat-card.tsx`
- `src/components/ui/status-badge.tsx`

### Files to modify
- `src/data/mockSignals.ts` — add new mock data
- `src/components/layout/AppLayout.tsx` — add header
- `src/components/layout/AppSidebar.tsx` — add 2 nav items
- `src/components/layout/MobileNav.tsx` — add 2 nav items (7 items, scrollable or priority)
- `src/pages/Index.tsx` — expanded dashboard
- `src/App.tsx` — add Watchlist and Journal routes

