# PipPilot AI

**AI-Assisted Forex Analysis Platform**

> PipPilot AI is a trading companion that provides AI-generated forex market analysis, trade signal suggestions, risk management tools, and a trade journal. It is **not** an auto-trading system — it's a decision-support tool built for retail forex traders.

⚠️ *AI-assisted analysis only — not financial advice. Trading carries significant risk.*

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Account overview, active signals, alerts, market watch, journal snapshot, daily trading tips |
| **Market Watch** | Monitor 16 forex instruments with live prices, spread, volatility, multi-timeframe trends, and session data |
| **Signal Explorer** | Browse algorithmically-generated trade setups with confidence scores, quality grades (A+/A/B/C), and AI-written explanations |
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
| Backend | Supabase — PostgreSQL with RLS + Edge Functions (Deno runtime) |
| Market Data | Twelve Data API (live OHLCV, 8 credits/min free tier) |
| AI | Claude Haiku via Anthropic API (explanation layer only) |
| Auth | Email/password with verification |

## Architecture

```
Frontend (React SPA)
  ├── Pages (Dashboard, Signals, Watchlist, Journal, Calculator, Alerts, Learn, Settings, Admin)
  ├── Hooks (use-signals, use-alerts, use-journal, use-watchlist, use-account,
  │          use-market-data, use-pip-value, use-daily-risk, use-admin)
  ├── Contexts (AuthContext — session + profile)
  ├── Lib (pip-value — live-rate pip value computation)
  └── Data (graceful fallback mocks when live data is unavailable)

Backend (Supabase)
  ├── Tables: profiles, trading_accounts, user_risk_profiles, signals,
  │           pair_analyses, alerts, trade_journal_entries, user_watchlist,
  │           instruments, market_data_cache, user_roles, admin_review_tags
  ├── RLS policies on all tables (authenticated read, scoped writes)
  ├── Auth triggers (auto-create profile + account + risk profile on signup)
  └── Edge Functions (Deno):
       ├── fetch-market-data  → pulls quotes + OHLCV from Twelve Data
       └── generate-signals   → TA engine + Claude AI explanations
                                (batched at 2 pairs/invocation)

Signal Pipeline (deterministic + AI)
  Twelve Data OHLCV (H1/H4/D1)
    → EMA/RSI/ATR/MACD/BB indicators
    → 5 setup patterns (Trend Pullback, Breakout Retest, Range Reversal,
                        Momentum Breakout, S/R Rejection)
    → Confluence score (0–100, base 50 ± factors)
    → Entry/SL/TP levels, quality grade, trade/no-trade verdict
    → Claude Haiku writes beginner/expert explanations + reasons
    → Written to signals + pair_analyses tables
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
│   ├── calculator/   # RiskCalculator (uses live pip values)
│   ├── journal/      # Entry form, detail drawer, filters
│   ├── layout/       # AppLayout, Sidebar, Header, MobileNav
│   ├── signals/      # SignalCard, SignalDetailDrawer
│   ├── ui/           # shadcn/ui + custom (stat-card, status-badge, empty-state)
│   └── ErrorBoundary.tsx  # App-level error boundary
├── contexts/         # AuthContext
├── data/             # Fallback mocks (used only if live data fails)
├── hooks/            # All data-fetching hooks
├── lib/              # pip-value.ts (core pip math library)
├── pages/            # One file per route
├── types/            # Trading type definitions
└── integrations/     # Supabase client + types (auto-generated)

supabase/
├── functions/
│   ├── _shared/      # indicators.ts (TA library), signal-engine.ts (core logic)
│   ├── fetch-market-data/   # scheduled Edge Function
│   └── generate-signals/    # signal engine + AI explanation Edge Function
└── migrations/       # SQL migrations (tables, RLS, FKs, indexes)
```

## What's Implemented (V1)

- ✅ Full auth flow (signup, login, email verification, password reset, onboarding)
- ✅ Dashboard with account stats, signals, alerts, market watch, journal
- ✅ **Live market data** for 16 instruments via Twelve Data Edge Function
- ✅ **Live pip-value computation** from real exchange rates (JPY, USD-quote, USD-base, crosses, XAU)
- ✅ **Deterministic signal engine** — indicators, 5 setup patterns, confluence scoring, quality grades
- ✅ **AI explanation layer** via Claude Haiku (explains; never decides)
- ✅ **Daily risk tracker** on dashboard, summed from today's open journal entries
- ✅ Signal explorer with 6 filters, AI-written beginner/expert explanations, reasons for/against
- ✅ Risk calculator with conservative mode and exposure warnings
- ✅ Trade journal with CRUD, stats, and filtering
- ✅ Learn hub (7 sections) with glossary and FAQ search
- ✅ Settings with profile, preferences, risk params, notifications
- ✅ Admin review panel (role-based)
- ✅ Error boundary + strict null checks + FK constraints with CASCADE
- ✅ Dark-first glassmorphic UI

## Migration Plan (5 Steps)

Implementation followed a 5-step migration from mock data to real backend:

| Step | Scope | Status |
|------|-------|--------|
| 1 | Real market data feed (Twelve Data + Edge Function cache) | ✅ Done |
| 2 | Real pip values from live exchange rates | ✅ Done |
| 3 | Deterministic signal generation engine | ✅ Done |
| 4 | AI explanation layer (Claude Haiku post-processing) | ✅ Done |
| 5 | Daily risk tracking (real committed risk from journal) | ✅ Done |

## Future Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 3** | Advanced analytics (equity curve, drawdown) + automated alerts (email, push, Telegram) |
| **Phase 4** | Optional broker integration (position tracking, not auto-trading) |
| **Phase 5** | AI learning from feedback + personalized recommendations |

## Documentation

Full documentation suite available in `/docs/`:
- **`SYSTEM_ARCHITECTURE.md`** — End-to-end technical architecture (pipeline, Edge Functions, signal engine, AI layer, tables, data flow)
- `USER_GUIDE.md` — Beginner-friendly walkthrough
- `FEATURES_SPEC.md` — Detailed feature breakdown
- `DATABASE_SCHEMA.md` — All tables, fields, RLS policies
- `API_CONTRACTS.md` — Supabase query contracts
- `SIGNAL_ENGINE_SPEC.md` — Original signal engine design spec
- `RISK_ENGINE_SPEC.md` — Position sizing and exposure formulas
- `ALERT_ENGINE_SPEC.md` — Alert types, triggers, delivery
- `UI_ARCHITECTURE.md` — Frontend structure and data flow
- `FUTURE_ROADMAP.md` — Phases 3–5

## Deployment

Environment variables required:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — in `.env` for the frontend

Supabase Edge Function secrets:
- `TWELVE_DATA_API_KEY` — for market data fetching
- `ANTHROPIC_API_KEY` — for AI explanations (optional; falls back to templates)

Deploy Edge Functions:
```bash
supabase functions deploy fetch-market-data
supabase functions deploy generate-signals
```

Invoke signal generation (batched, 2 pairs per invocation, batches 0–7):
```bash
curl -X POST "https://<project>.supabase.co/functions/v1/generate-signals?batch=0" \
  -H "Authorization: Bearer <anon-key>"
```

## License

Private project. All rights reserved.
