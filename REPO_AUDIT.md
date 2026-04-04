# PipPilot AI — Repository Audit

**Date**: 2026-04-04
**Commit**: `b9ccc17` (main, clean)
**Purpose**: Freeze the current baseline before any refactoring begins.

---

## 1. Project Summary

PipPilot AI is an AI-assisted forex analysis platform — a decision-support tool for retail traders. It provides market analysis, trade signal suggestions, risk management tools, and a trade journal. **It does not execute trades.**

- **Phase**: MVP (V1) — complete
- **Architecture**: Single-page application (no SSR) with Supabase backend
- **Deployment**: Lovable Cloud (managed Supabase hosting)

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.8.3 |
| Build | Vite (SWC) | 5.4.19 |
| Styling | Tailwind CSS | 3.4.17 |
| Components | shadcn/ui (Radix) | 54 components |
| State (server) | TanStack React Query | 5.83.0 |
| State (auth) | React Context | — |
| Routing | React Router | 6.30.1 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Charts | Recharts | 2.15.4 |
| Backend | Supabase (PostgreSQL) | JS SDK 2.101.1 |
| Icons | Lucide React | 0.462.0 |
| Dark mode | next-themes | 0.3.0 |
| Toasts | Sonner | 1.7.4 |
| Dates | date-fns | 3.6.0 |

**Dev tooling**: Vitest 3.2.4, Playwright 1.57.0, ESLint 9.32.0, Testing Library

---

## 3. Directory Structure

```
pippilot/
├── docs/                           # 10 specification documents
│   ├── README.md                   # System overview
│   ├── FEATURES_SPEC.md            # Feature breakdown
│   ├── DATABASE_SCHEMA.md          # Tables, fields, RLS policies
│   ├── API_CONTRACTS.md            # Supabase query contracts
│   ├── SIGNAL_ENGINE_SPEC.md       # Planned signal generation (Phase 2+)
│   ├── RISK_ENGINE_SPEC.md         # Position sizing formulas
│   ├── ALERT_ENGINE_SPEC.md        # Alert types & delivery
│   ├── UI_ARCHITECTURE.md          # Frontend structure & data flow
│   ├── USER_GUIDE.md               # Walkthrough for users
│   └── FUTURE_ROADMAP.md           # Phases 2–5
│
├── supabase/
│   ├── config.toml                 # Project: oligqfowvcumeymxdpeb
│   └── migrations/                 # 9 SQL migration files
│       ├── 20260402081317_*.sql    # Initial schema
│       ├── 20260402083115_*.sql    # Profile columns
│       ├── 20260402084011_*.sql    # Core tables (accounts, risk, instruments, journal)
│       ├── 20260402115447_*.sql    # handle_new_user trigger update
│       ├── 20260402115509_*.sql    # Signal status enum expansion
│       ├── 20260402170117_*.sql    # Timeframe column on alerts
│       ├── 20260404065405_*.sql    # Journal entry columns
│       ├── 20260404071520_*.sql    # Profile preferences columns
│       └── 20260404075609_*.sql    # Review columns + admin policy
│
├── src/
│   ├── App.tsx                     # Router + providers
│   ├── main.tsx                    # React 18 entry
│   ├── index.css                   # Global styles + CSS variables
│   │
│   ├── components/                 # 65 files
│   │   ├── admin/                  # ReviewNotesPopover, ReviewTagSelect
│   │   ├── auth/                   # ProtectedRoute
│   │   ├── calculator/             # RiskCalculator
│   │   ├── journal/                # JournalEntryForm, JournalDetailDrawer, JournalFilters
│   │   ├── layout/                 # AppLayout, AppHeader, AppSidebar, MobileNav
│   │   ├── signals/                # SignalCard, SignalDetailDrawer
│   │   └── ui/                     # 54 shadcn/ui + 3 custom (stat-card, status-badge, empty-state)
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx          # Session + profile + signOut
│   │
│   ├── data/                        # ⚠ MOCK DATA
│   │   ├── mockMarketData.ts        # 14 instruments, 6 pair analyses
│   │   └── mockSignals.ts           # 8 signals, 7 alerts, stats, journal, etc.
│   │
│   ├── hooks/                       # 11 custom hooks
│   │   ├── use-account.ts           # Trading account & risk profile (Supabase)
│   │   ├── use-admin.ts             # Admin review ops (Supabase)
│   │   ├── use-alerts.ts            # Alert CRUD (Supabase)
│   │   ├── use-journal.ts           # Journal CRUD + stats (Supabase)
│   │   ├── use-market-data.ts       # ⚠ ALL MOCK — integration seam
│   │   ├── use-mobile.tsx           # Responsive detection
│   │   ├── use-signals.ts           # Signal queries (Supabase) + mock enrichment
│   │   ├── use-toast.ts             # Toast notifications
│   │   └── use-watchlist.ts         # Watchlist CRUD (Supabase)
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts            # createClient initialization
│   │       └── types.ts             # Auto-generated DB types
│   │
│   ├── lib/
│   │   └── utils.ts                 # clsx + tailwind-merge
│   │
│   ├── pages/                       # 18 page components
│   │   ├── Index.tsx                # Dashboard
│   │   ├── Signals.tsx              # Signal explorer (6 filters)
│   │   ├── SignalDetail.tsx         # Signal detail view
│   │   ├── Watchlist.tsx            # Market watch
│   │   ├── PairDetail.tsx           # Per-pair deep dive
│   │   ├── Journal.tsx              # Trade journal
│   │   ├── CalculatorPage.tsx       # Risk calculator
│   │   ├── Alerts.tsx               # Alert center
│   │   ├── SettingsPage.tsx         # User settings
│   │   ├── AdminReview.tsx          # Admin panel
│   │   ├── Learn.tsx                # Help hub
│   │   ├── Login.tsx                # Auth
│   │   ├── Signup.tsx               # Auth
│   │   ├── ForgotPassword.tsx       # Auth
│   │   ├── ResetPassword.tsx        # Auth
│   │   ├── Onboarding.tsx           # Post-signup wizard
│   │   └── NotFound.tsx             # 404
│   │
│   ├── types/
│   │   └── trading.ts               # DB row aliases + enriched types + mock re-exports
│   │
│   └── test/
│       ├── example.test.ts          # Single example test
│       └── setup.ts                 # Vitest setup
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── components.json                  # shadcn/ui CLI config
├── .env                             # Supabase credentials
└── index.html
```

**File counts**: 18 pages, 65 components (54 shadcn/ui + 11 feature), 11 hooks, 2 mock data files, 1 context, 1 integration module, 1 types file, 1 utility file.

---

## 4. Database Schema

**9 tables**, all with Row-Level Security enabled:

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profile, preferences, onboarding status | Own data only |
| `trading_accounts` | Balance, equity, leverage (multiple per user, one default) | Own data only |
| `user_risk_profiles` | Risk %, daily loss limit, conservative mode | Own data only |
| `signals` | Trade setups: pair, direction, entry/SL/TP, confidence, verdict, ai_reasoning | Public read, admin write |
| `alerts` | Price/indicator alerts linked to signals | Own data only, admin read |
| `trade_journal_entries` | Logged trades with P/L, emotions, lessons | Own data only |
| `user_watchlist` | Favorite pairs (unique per user+pair) | Own data only |
| `instruments` | 15 forex pairs (EUR/USD, GBP/USD, etc.) with pip_value | Public read |
| `user_roles` | Admin/moderator/user role assignment | Admin access |

**Triggers**: `handle_new_user()` fires on `auth.users` INSERT — auto-creates profile, trading_account, and user_risk_profile.

**Security definer**: `has_role(user_id, role)` function used in admin RLS policies.

---

## 5. Routing Map

### Public (no auth)
| Path | Page | Purpose |
|------|------|---------|
| `/login` | Login.tsx | Email/password sign-in |
| `/signup` | Signup.tsx | Registration |
| `/forgot-password` | ForgotPassword.tsx | Password reset request |
| `/reset-password` | ResetPassword.tsx | Password reset completion |

### Protected (auth required, AppLayout wrapper)
| Path | Page | Purpose |
|------|------|---------|
| `/` | Index.tsx | Dashboard (stats, signals, alerts, market, journal, tip) |
| `/watchlist` | Watchlist.tsx | Market watch with instrument cards |
| `/watchlist/:pair` | PairDetail.tsx | Multi-timeframe analysis per pair |
| `/signals` | Signals.tsx | Signal explorer with 6 filters |
| `/signals/:id` | SignalDetail.tsx | Signal detail drawer |
| `/calculator` | CalculatorPage.tsx | Position size calculator |
| `/alerts` | Alerts.tsx | Alert center (severity, read/unread) |
| `/journal` | Journal.tsx | Trade journal CRUD + stats |
| `/settings` | SettingsPage.tsx | Profile, preferences, risk params |
| `/learn` | Learn.tsx | Help/learning hub |
| `/admin` | AdminReview.tsx | Signal & alert review (admin only) |

### Special
| Path | Page | Purpose |
|------|------|---------|
| `/onboarding` | Onboarding.tsx | Post-signup wizard (protected, no layout) |
| `*` | NotFound.tsx | 404 fallback |

---

## 6. Authentication

- **Provider**: Supabase Auth (email/password only)
- **Session**: localStorage persistence, auto-token refresh
- **Context**: `AuthContext.tsx` provides `session`, `user`, `profile`, `loading`, `signOut()`
- **Protection**: `ProtectedRoute` component wraps all authenticated routes
- **Admin**: `user_roles` table + `has_role()` security definer function
- **Flows**: Sign up → email verification → onboarding wizard → dashboard

---

## 7. External Integrations

**None.** The application has zero external API integrations.

- No market data API (mock data only)
- No AI/LLM API (signals are static DB rows)
- No notification services (email, push, Telegram — planned Phase 3)
- No broker API (planned Phase 4)
- No payment processing

The only backend is Supabase PostgREST (auto-generated REST from PostgreSQL schema).

---

## 8. Data Hooks Summary

| Hook | Backend | Mock | Purpose |
|------|---------|------|---------|
| `use-account.ts` | Supabase | — | Trading account + risk profile |
| `use-admin.ts` | Supabase | — | Admin signal/alert review |
| `use-alerts.ts` | Supabase | — | Alert CRUD + unread count |
| `use-journal.ts` | Supabase | — | Journal CRUD + computed stats |
| `use-market-data.ts` | — | **All mock** | Market prices, pair analysis, summary |
| `use-signals.ts` | Supabase | **Enrichment** | Signal queries + mock analysis overlay |
| `use-watchlist.ts` | Supabase | — | Watchlist CRUD + instruments |
| `use-mobile.tsx` | — | — | Responsive breakpoint detection |
| `use-toast.ts` | — | — | Toast notification helper |

---

## 9. Testing

- **Unit**: Vitest 3.2.4 configured, 1 example test (`src/test/example.test.ts`)
- **E2E**: Playwright 1.57.0 configured with fixtures (`playwright-fixture.ts`)
- **Coverage**: Minimal — no meaningful test coverage yet
- **CI**: No CI/CD pipeline detected in repo

---

## 10. Documentation

10 spec files in `/docs/`:

| Document | Status | Notes |
|----------|--------|-------|
| README.md | Current | System overview, MVP scope |
| FEATURES_SPEC.md | Current | Feature breakdown per section |
| DATABASE_SCHEMA.md | Current | All tables, fields, RLS |
| API_CONTRACTS.md | Current | Supabase query patterns |
| SIGNAL_ENGINE_SPEC.md | **Future** | Phase 2+ signal generation spec |
| RISK_ENGINE_SPEC.md | Partial | Formulas exist, pip value placeholder |
| ALERT_ENGINE_SPEC.md | **Future** | Phase 3 alert delivery spec |
| UI_ARCHITECTURE.md | Current | Route map, component hierarchy |
| USER_GUIDE.md | Current | Beginner walkthrough |
| FUTURE_ROADMAP.md | Current | Phases 2–5 plan |

---

## 11. Build & Scripts

```
npm run dev        → vite (port 8080)
npm run build      → vite build (production)
npm run build:dev  → vite build --mode development
npm run preview    → vite preview
npm run lint       → eslint .
npm run test       → vitest run
npm run test:watch → vitest
```

---

## 12. Key Observations

1. **Clean separation**: Supabase handles all user data (signals, journal, alerts, watchlist, accounts). Mock data handles all market intelligence.
2. **Single integration seam**: `use-market-data.ts` is the documented swap point for replacing mock→real market data.
3. **No edge functions**: The `supabase/` directory has migrations only. No edge functions exist yet.
4. **Type safety**: Auto-generated Supabase types in `types.ts`, but TypeScript strict mode is disabled.
5. **UI complete**: All planned V1 pages and components are built and functional with mock data.
6. **No external calls**: The app makes zero HTTP requests outside of Supabase PostgREST.
