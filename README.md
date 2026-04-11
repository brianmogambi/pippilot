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
| **Alerts Center** | Notifications for signal events and market conditions with severity levels (event-aware deduplication) |
| **Trade Journal** | Log trades with entry/exit, emotions, lessons learned, and performance stats |
| **Pair Detail** | Deep-dive analysis per pair: live OHLCV chart, key levels, structure, AI reasoning, signal & journal history |
| **Live Charts** | Real candlestick charts (5m / 15m / 1H / 4H / 1D) with on-chart entry/SL/TP overlays |
| **Freshness Indicators** | Every data widget labels itself as **Live**, **Cached**, or **Demo** so the user always knows whether they're looking at fresh data, stale cache, or a fallback |
| **Settings** | Profile, preferred pairs/sessions/strategies, risk parameters, notifications |
| **Admin Review** | Role-based panel for reviewing and tagging AI-generated signals (quality control) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5 · Vite 5 |
| Styling | Tailwind CSS v3 · shadcn/ui (Radix) |
| Data | TanStack React Query v5 |
| Routing | React Router v6 |
| Charts | Recharts (stat widgets) · lightweight-charts (live candlesticks) |
| Forms | React Hook Form · Zod |
| Backend | Supabase — PostgreSQL with RLS + Edge Functions (Deno runtime) |
| Market Data | Twelve Data API (live OHLCV, 8 credits/min free tier) |
| AI | Claude Haiku via Anthropic API (explanation layer only — versioned prompts) |
| Auth | Email/password with verification |
| Testing | Vitest (113 tests across pure engine modules) |

## Architecture

```
Frontend (React SPA)
  ├── Pages (Dashboard, Signals, Watchlist, Journal, Calculator, Alerts, Learn, Settings, Admin)
  ├── Hooks (use-signals, use-alerts, use-journal, use-watchlist, use-account,
  │          use-market-data, use-pip-value, use-daily-risk, use-candles, use-admin)
  ├── Contexts (AuthContext — session + profile)
  ├── Lib (pure, vitest-tested)
  │    ├── pip-value          — live-rate pip value computation
  │    ├── risk-engine        — position sizing, daily-loss caps, exposure
  │    ├── alert-engine       — event-aware alert evaluation + deduplication
  │    ├── explanation-service — versioned-prompt AI/template fallback
  │    ├── data-freshness    — Live/Cached/Demo classification
  │    ├── indicators         — EMA/RSI/ATR/MACD/BB
  │    └── chart-colors       — chart palette
  └── Components (chart, calculator, journal, signals, ui, …)

Backend (Supabase)
  ├── Tables: profiles, trading_accounts, user_risk_profiles, signals,
  │           pair_analyses, alerts, alert_state_log, trade_journal_entries,
  │           user_watchlist, instruments, market_data_cache, ohlcv_candles,
  │           generation_runs, user_roles, admin_review_tags
  ├── RLS policies on all tables (authenticated read, scoped writes)
  ├── Auth triggers (auto-create profile + account + risk profile on signup)
  └── Edge Functions (Deno):
       ├── fetch-market-data  → pulls quotes from Twelve Data into market_data_cache
       ├── fetch-candles      → pulls OHLCV bars into ohlcv_candles
       ├── generate-signals   → TA engine + Claude AI explanations
       │                       (batched at 2 pairs/invocation, audited via generation_runs)
       └── evaluate-alerts    → walks open signals, fires entry/SL/TP/invalidation events

Signal Pipeline (deterministic + AI)
  Twelve Data OHLCV (5m → 1D)
    → EMA/RSI/ATR/MACD/BB indicators
    → 5 setup patterns (Trend Pullback, Breakout Retest, Range Reversal,
                        Momentum Breakout, S/R Rejection)
    → Confluence score (0–100, base 50 ± factors)
    → Entry/SL/TP levels, quality grade, trade/no-trade verdict
    → explanation-service → Claude Haiku (versioned prompts) writes
       beginner/expert explanations + reasons
       (deterministic template fallback when API key missing or call fails;
        per-row status persisted as ai_success/ai_failed/ai_skipped/template_only)
    → Written to signals + pair_analyses tables
    → generation_runs row records ai_calls_attempted/succeeded/failed/skipped
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
│   ├── chart/        # CandlestickChart, SetupContextBar, overlays
│   ├── journal/      # Entry form, detail drawer, filters
│   ├── layout/       # AppLayout, Sidebar, Header, MobileNav
│   ├── signals/      # SignalCard, SignalDetailDrawer
│   ├── ui/           # shadcn/ui + custom (stat-card, status-badge w/ FreshnessBadge, empty-state)
│   └── ErrorBoundary.tsx  # App-level error boundary
├── contexts/         # AuthContext
├── hooks/            # All data-fetching hooks
│   └── _shared/      # row-to-analysis mapper shared by use-signals + use-market-data
├── lib/              # Pure, vitest-tested modules
│   ├── pip-value.ts        — live-rate pip value computation
│   ├── risk-engine.ts      — position sizing, daily-loss caps
│   ├── alert-engine.ts     — event-aware alert evaluation
│   ├── explanation-service.ts — versioned-prompt AI/template fallback
│   ├── data-freshness.ts   — Live/Cached/Demo classification
│   ├── indicators.ts       — EMA/RSI/ATR/MACD/BB
│   ├── chart-colors.ts     — chart palette
│   └── __tests__/          — vitest suites (113 tests)
├── pages/            # One file per route
├── types/            # Trading type definitions
└── integrations/     # Supabase client + types (auto-generated)

supabase/
├── functions/
│   ├── _shared/                # Deno mirrors of pure modules (signal-engine,
│   │                           #   risk-engine, alert-engine, explanation-service,
│   │                           #   pip-value, indicators)
│   ├── fetch-market-data/      # Edge Function — Twelve Data quotes
│   ├── fetch-candles/          # Edge Function — Twelve Data OHLCV bars
│   ├── generate-signals/       # Edge Function — signal engine + AI explanations
│   └── evaluate-alerts/        # Edge Function — alert event evaluation
└── migrations/                 # SQL migrations (tables, RLS, FKs, indexes)
```

## What's Implemented

- ✅ Full auth flow (signup, login, email verification, password reset, onboarding)
- ✅ Dashboard with account stats, signals, alerts, market watch, journal
- ✅ **Live market data** for 16 instruments via Twelve Data Edge Function
- ✅ **Live pip-value computation** from real exchange rates (JPY, USD-quote, USD-base, crosses, XAU)
- ✅ **Deterministic signal engine** — indicators, 5 setup patterns, confluence scoring, quality grades
- ✅ **Live candlestick charts** (5m / 15m / 1H / 4H / 1D) with on-chart entry/SL/TP overlays
- ✅ **Risk engine v2** — pure module, daily loss caps, exposure warnings, vitest-covered
- ✅ **Alert engine v2** — event-aware deduplication via `alert_state_log`, vitest-covered
- ✅ **Explanation hardening** — versioned prompts, AI/template fallback metadata persisted
  per row, per-run AI counters on `generation_runs`
- ✅ **Frontend real-data conversion** — Live/Cached/Demo badges across Dashboard,
  Watchlist, PairDetail, SignalDetail; silent fallbacks eliminated
- ✅ **Daily risk tracker** on dashboard, summed from today's open journal entries
- ✅ Signal explorer with 6 filters, AI-written beginner/expert explanations, reasons for/against
- ✅ Risk calculator with conservative mode and exposure warnings
- ✅ Trade journal with CRUD, stats, and filtering
- ✅ Learn hub (7 sections) with glossary and FAQ search
- ✅ Settings with profile, preferences, risk params, notifications
- ✅ Admin review panel (role-based)
- ✅ Error boundary + strict null checks + FK constraints with CASCADE
- ✅ Dark-first glassmorphic UI
- ✅ **113 vitest tests** across pure engine modules

## Phase History

| Phase | Scope | Status |
|------|-------|--------|
| 1 | Real market data feed (Twelve Data + Edge Function cache) | ✅ Done |
| 2 | Real pip values from live exchange rates | ✅ Done |
| 3 | Deterministic signal generation engine | ✅ Done |
| 4 | AI explanation layer (Claude Haiku post-processing) | ✅ Done |
| 5 | Daily risk tracking (real committed risk from journal) | ✅ Done |
| 6 | Risk engine v2 (pure module, vitest, daily loss caps) | ✅ Done |
| 7 | Alert engine v2 (event-aware dedup, alert_state_log) | ✅ Done |
| 8 | Explanation hardening (versioned prompts, metadata audit trail) | ✅ Done |
| 9 | Frontend real-data conversion (Live/Cached/Demo badges) | ✅ Done |

## Future Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 10** | Advanced analytics (equity curve, drawdown, per-pair P/L) |
| **Phase 11** | Automated alerts (email, push, Telegram) |
| **Phase 12** | Optional broker integration (position tracking, not auto-trading) |
| **Phase 13** | AI learning from feedback + personalized recommendations |

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
