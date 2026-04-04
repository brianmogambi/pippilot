# PipPilot AI

**AI-Assisted Forex Analysis Platform**

> PipPilot AI is a trading companion that provides AI-generated forex market analysis, trade signal suggestions, risk management tools, and a trade journal. It is **not** an auto-trading system — it's a decision-support tool built for retail forex traders.

⚠️ *AI-assisted analysis only — not financial advice. Trading carries significant risk.*

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Account overview, active signals, alerts, market watch, journal snapshot, daily trading tips |
| **Market Watch** | Monitor 15 forex instruments with price, spread, volatility, multi-timeframe trends, and session data |
| **Signal Explorer** | Browse AI-generated trade setups with confidence scores, quality grades, and full reasoning |
| **Risk Calculator** | Position sizing with risk %, conservative mode, exposure warnings, and daily loss tracking |
| **Alerts Center** | Notifications for signal events and market conditions with severity levels |
| **Trade Journal** | Log trades with entry/exit, emotions, lessons learned, and performance stats |
| **Pair Detail** | Deep-dive analysis per pair: key levels, structure, AI reasoning, signal & journal history |
| **Settings** | Profile, preferred pairs/sessions/strategies, risk parameters, notifications |
| **Admin Review** | Role-based panel for reviewing and tagging AI-generated signals (quality control) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5 · Vite 5 |
| Styling | Tailwind CSS v3 · shadcn/ui (Radix) |
| Data | TanStack React Query v5 |
| Routing | React Router v6 |
| Charts | Recharts |
| Forms | React Hook Form · Zod |
| Backend | Lovable Cloud (Supabase) — PostgreSQL with RLS |
| Auth | Email/password with verification |

## Architecture

```
Frontend (React SPA)
  ├── Pages (Dashboard, Signals, Watchlist, Journal, Calculator, Alerts, Settings, Admin)
  ├── Hooks (use-signals, use-alerts, use-journal, use-watchlist, use-account, use-admin)
  ├── Contexts (AuthContext — session + profile)
  └── Mock Data (market prices + pair analysis — to be replaced by real APIs)

Backend (Lovable Cloud / Supabase)
  ├── Tables: profiles, trading_accounts, user_risk_profiles, signals, alerts,
  │           trade_journal_entries, user_watchlist, instruments, user_roles
  ├── RLS policies on all tables
  ├── Auth triggers (auto-create profile + account + risk profile on signup)
  └── Edge Functions (planned for signal engine)
```

## Core Principles

1. **Risk-First** — Position sizing, daily loss limits, conservative mode, exposure warnings
2. **Transparency** — Every signal includes full reasoning, pros/cons, and invalidation criteria
3. **"No Trade" is valid** — The AI recommends skipping when conditions are unfavorable
4. **Education** — Beginner-friendly explanations, daily tips, emotional journaling
5. **No guarantees** — Disclaimers throughout; this is analysis, not advice

## Project Structure

```
src/
├── components/
│   ├── admin/        # Admin review components
│   ├── auth/         # ProtectedRoute
│   ├── calculator/   # RiskCalculator
│   ├── journal/      # Entry form, detail drawer, filters
│   ├── layout/       # AppLayout, Sidebar, Header, MobileNav
│   ├── signals/      # SignalCard, SignalDetailDrawer
│   └── ui/           # shadcn/ui + custom (stat-card, status-badge, empty-state)
├── contexts/         # AuthContext
├── data/             # Mock market data + pair analysis
├── hooks/            # All data-fetching hooks
├── pages/            # One file per route
├── types/            # Trading type definitions
└── integrations/     # Supabase client + types (auto-generated)
```

## MVP Scope (V1 — Current)

- ✅ Full auth flow (signup, login, email verification, password reset, onboarding)
- ✅ Dashboard with account stats, signals, alerts, market watch, journal
- ✅ 15 instruments with mock market data
- ✅ Signal explorer with 6 filters and detail drawer
- ✅ Risk calculator with conservative mode and exposure warnings
- ✅ Trade journal with CRUD, stats, and filtering
- ✅ Settings with profile, preferences, risk params, notifications
- ✅ Admin review panel (role-based)
- ✅ Dark-first glassmorphic UI

## Future Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 2** | Real market data API + AI signal engine (Edge Function) |
| **Phase 3** | Advanced analytics (equity curve, drawdown) + automated alerts (email, push, Telegram) |
| **Phase 4** | Optional broker integration (position tracking, not auto-trading) |
| **Phase 5** | AI learning from feedback + personalized recommendations |

## Documentation

Full documentation suite available in `/docs/` (or generated via the app):
- `USER_GUIDE.md` — Beginner-friendly walkthrough
- `FEATURES_SPEC.md` — Detailed feature breakdown
- `DATABASE_SCHEMA.md` — All tables, fields, RLS policies
- `API_CONTRACTS.md` — Supabase query contracts
- `SIGNAL_ENGINE_SPEC.md` — Planned signal generation logic
- `RISK_ENGINE_SPEC.md` — Position sizing and exposure formulas
- `ALERT_ENGINE_SPEC.md` — Alert types, triggers, delivery
- `UI_ARCHITECTURE.md` — Frontend structure and data flow
- `FUTURE_ROADMAP.md` — Phases 2–5

## License

Private project. All rights reserved.
