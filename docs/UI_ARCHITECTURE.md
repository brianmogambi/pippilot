# PipPilot AI — UI Architecture

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (SPA, no SSR) |
| Language | TypeScript 5 (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS v3 + tailwindcss-animate |
| Components | shadcn/ui (Radix UI primitives) |
| Charts | Recharts |
| Routing | React Router v6 (BrowserRouter) |
| State | TanStack React Query v5 (server state), React Context (auth), React useState (local) |
| Forms | React Hook Form + Zod |
| Notifications | Sonner (toasts) + shadcn Toaster |

---

## Page Structure

### Route Map
```
/login              → Login.tsx           (public)
/signup             → Signup.tsx           (public)
/forgot-password    → ForgotPassword.tsx   (public)
/reset-password     → ResetPassword.tsx    (public)
/onboarding         → Onboarding.tsx       (protected, no layout)
/                   → Index.tsx            (protected + AppLayout)
/watchlist           → Watchlist.tsx        (protected + AppLayout)
/watchlist/:pair     → PairDetail.tsx       (protected + AppLayout)
/signals             → Signals.tsx          (protected + AppLayout)
/signals/:id         → SignalDetail.tsx     (protected + AppLayout)
/calculator          → CalculatorPage.tsx   (protected + AppLayout)
/alerts              → Alerts.tsx           (protected + AppLayout)
/journal             → Journal.tsx          (protected + AppLayout)
/settings            → SettingsPage.tsx     (protected + AppLayout)
/admin               → AdminReview.tsx      (protected + AppLayout, admin only)
*                    → NotFound.tsx         (public)
```

### Route Protection
- `ProtectedRoute` component wraps all authenticated routes
- Checks `useAuth()` for active session
- Redirects to `/login` if unauthenticated
- Redirects to `/onboarding` if `profile.onboarding_completed === false`

---

## Layout System

### AppLayout
```
┌─────────────────────────────────────────────┐
│ AppSidebar (desktop)  │  AppHeader          │
│ w-64, hidden on       │  sticky top, h-14   │
│ mobile                │                      │
│                       ├─────────────────────│
│ Navigation links      │  <Outlet />          │
│ Admin link (if admin) │  (page content)      │
│ Sign out              │                      │
│ Disclaimer            │                      │
│ Version tag           │                      │
└─────────────────────────────────────────────┘
│ MobileNav (mobile only, fixed bottom)        │
└─────────────────────────────────────────────┘
```

### Components
| Component | File | Description |
|-----------|------|-------------|
| `AppLayout` | `src/components/layout/AppLayout.tsx` | Flex container: sidebar + main column + mobile nav |
| `AppSidebar` | `src/components/layout/AppSidebar.tsx` | Desktop sidebar (hidden on mobile). Nav links, admin link, sign out, disclaimer, version |
| `AppHeader` | `src/components/layout/AppHeader.tsx` | Top bar with page title, balance/equity display, notification bell (links to /alerts), avatar (links to /settings) |
| `MobileNav` | `src/components/layout/MobileNav.tsx` | Fixed bottom navigation bar for mobile. Core pages only (Dashboard, Watchlist, Signals, Journal, Settings) |

---

## Component Hierarchy

### Shared UI Components (`src/components/ui/`)
All from shadcn/ui with customizations:

| Component | Purpose |
|-----------|---------|
| `stat-card.tsx` | Numeric stat display with icon, label, value, optional trend |
| `status-badge.tsx` | Color-coded badge for statuses (active, bullish, bearish, etc.) |
| `empty-state.tsx` | Reusable empty state with icon, title, description, optional CTA |
| `button.tsx` | Button with variants (default, outline, ghost, destructive, link) |
| `input.tsx` | Text input |
| `select.tsx` | Dropdown select (Radix) |
| `table.tsx` | Data table components (Table, TableHeader, TableBody, TableRow, TableCell) |
| `card.tsx` | Card container |
| `drawer.tsx` | Slide-out drawer (Vaul) |
| `skeleton.tsx` | Loading placeholder |
| `badge.tsx` | Simple badge |
| `tabs.tsx` | Tab navigation |
| `switch.tsx` | Toggle switch |
| `slider.tsx` | Range slider |
| `checkbox.tsx` | Checkbox |
| `dialog.tsx` | Modal dialog |
| `popover.tsx` | Floating popover |
| `separator.tsx` | Visual divider |
| `scroll-area.tsx` | Scrollable container |
| `tooltip.tsx` | Hover tooltip |
| `sonner.tsx` | Toast notification wrapper |
| `form.tsx` | React Hook Form integration |

### Feature Components

| Component | File | Used By |
|-----------|------|---------|
| `SignalCard` | `src/components/signals/SignalCard.tsx` | Signals (mobile), Dashboard |
| `SignalDetailDrawer` | `src/components/signals/SignalDetailDrawer.tsx` | Signals page |
| `RiskCalculator` | `src/components/calculator/RiskCalculator.tsx` | CalculatorPage, SignalDetailDrawer |
| `JournalEntryForm` | `src/components/journal/JournalEntryForm.tsx` | Journal page |
| `JournalDetailDrawer` | `src/components/journal/JournalDetailDrawer.tsx` | Journal page |
| `JournalFilters` | `src/components/journal/JournalFilters.tsx` | Journal page |
| `ReviewTagSelect` | `src/components/admin/ReviewTagSelect.tsx` | AdminReview |
| `ReviewNotesPopover` | `src/components/admin/ReviewNotesPopover.tsx` | AdminReview |
| `NavLink` | `src/components/NavLink.tsx` | Mobile navigation |

---

## State Management

### Server State (TanStack React Query)
All data from the database is managed via React Query hooks. Each hook:
- Defines a unique `queryKey` for caching
- Uses `enabled` flag tied to `!!user` (no queries without auth)
- Returns `{ data, isLoading, error }` or enriched versions

**Hook files:**
| File | Exports |
|------|---------|
| `use-signals.ts` | `useSignals`, `useActiveSignals`, `useSignalsByPair`, `getQualityForSignal` |
| `use-alerts.ts` | `useAlerts`, `useDashboardAlerts`, `useUnreadAlertCount`, `useMarkAlertRead`, `useMarkAllAlertsRead` |
| `use-journal.ts` | `useJournalEntries`, `useDashboardJournal`, `useJournalByPair`, `useDashboardJournalStats`, `useJournalStats`, `useCreateJournalEntry`, `useUpdateJournalEntry`, `useDeleteJournalEntry` |
| `use-watchlist.ts` | `useWatchlist`, `useDashboardWatchlist`, `useInstruments`, `useAddToWatchlist`, `useRemoveFromWatchlist` |
| `use-account.ts` | `useTradingAccount`, `useRiskProfile` |
| `use-admin.ts` | `useIsAdmin`, `useAdminSignals`, `useAdminAlerts`, `useReviewSignal`, `useReviewAlert`, `useSignalReviewStats` |
| `use-market-data.ts` | `useMarketSummary` (mock data) |

### Auth State (React Context)
`AuthContext` provides:
- `session`, `user` — from Supabase Auth
- `profile` — from `profiles` table
- `loading`, `profileLoading` — loading states
- `signOut()`, `refetchProfile()` — actions

### Local State (React useState)
Used for:
- Form inputs (controlled components)
- Filter selections
- Drawer open/close state
- Dismissable elements (trading tip)

---

## Data Flow: Mock → Real

### Current (V1)
```
Mock Data (src/data/)          DB (Supabase)
├── mockMarketData ──────▶ Watchlist prices, spreads, trends
├── mockPairAnalysis ────▶ Signal quality, analysis text
│
│                           ├── signals ──────▶ Signal list, detail
│                           ├── alerts ───────▶ Alert list
│                           ├── trade_journal ─▶ Journal entries
│                           ├── profiles ─────▶ User settings
│                           ├── trading_accounts ▶ Balance/equity
│                           ├── user_risk_profiles ▶ Risk params
│                           ├── user_watchlist ──▶ Favorites
│                           └── instruments ────▶ Pair list
```

### Future (V2)
```
Market Data API ──▶ Edge Function ──▶ signals table ──▶ Frontend
                        │
                        ▼
                   alerts table ──▶ Frontend (realtime)
```

Mock data files (`mockMarketData.ts`, `mockSignals.ts`) will be replaced by:
1. Real-time price feeds via WebSocket or REST polling
2. AI-generated analysis from the signal engine Edge Function
3. The `getMarketData()` and `getPairAnalysis()` functions will call APIs instead of returning static objects

---

## Design System

### Theme
- Dark-first design with `bg-background` (#0F172A)
- Primary: `#3B82F6` (blue)
- Semantic colors: `bullish` (green), `bearish` (red), `warning` (amber)
- Font: Inter (system default)
- Glassmorphic card style with subtle borders and transparency

### CSS Tokens (index.css)
All colors use HSL values via CSS custom properties:
```css
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground
--border, --input, --ring
--sidebar (sidebar-specific tokens)
--bullish, --bearish, --warning (trading-specific)
```

### Responsive Breakpoints
- Mobile: < 768px (single column, bottom nav, card-based layouts)
- Tablet: 768px–1024px (sidebar visible, adjusted grids)
- Desktop: > 1024px (full layout, tables, multi-column grids)

### Utility Classes
- `pb-mobile-nav` — bottom padding to account for fixed mobile navigation
- Standardized filter bar heights: `h-8`
- Standardized table headers: `bg-muted/30` with sticky positioning

---

## File Organization

```
src/
├── components/
│   ├── admin/          # Admin-specific components
│   ├── auth/           # ProtectedRoute
│   ├── calculator/     # RiskCalculator
│   ├── journal/        # Journal form, drawer, filters
│   ├── layout/         # AppLayout, AppSidebar, AppHeader, MobileNav
│   ├── signals/        # SignalCard, SignalDetailDrawer
│   └── ui/             # shadcn/ui components + custom (stat-card, status-badge, empty-state)
├── contexts/
│   └── AuthContext.tsx  # Auth provider with session + profile
├── data/
│   ├── mockMarketData.ts  # Static market data + pair analysis
│   └── mockSignals.ts     # Additional mock data
├── hooks/
│   ├── use-account.ts     # Trading account + risk profile queries
│   ├── use-admin.ts       # Admin review queries + mutations
│   ├── use-alerts.ts      # Alert queries + mutations
│   ├── use-journal.ts     # Journal CRUD + stats
│   ├── use-market-data.ts # Mock market summary
│   ├── use-signals.ts     # Signal queries + enrichment
│   └── use-watchlist.ts   # Watchlist + instruments queries
├── integrations/
│   └── supabase/
│       ├── client.ts      # Auto-generated Supabase client (DO NOT EDIT)
│       └── types.ts       # Auto-generated DB types (DO NOT EDIT)
├── lib/
│   └── utils.ts           # cn() utility for class merging
├── pages/                 # One file per route
├── types/
│   └── trading.ts         # Type aliases and interfaces
├── index.css              # Global styles + design tokens
└── main.tsx               # App entry point
```
