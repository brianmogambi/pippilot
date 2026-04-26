# PipPilot AI

**AI-Assisted Forex Analysis Platform**

> PipPilot AI is a trading companion that provides AI-generated forex market analysis, trade signal suggestions, risk management tools, and a trade journal. It is **not** an auto-trading system — it's a decision-support tool built for retail forex traders.

⚠️ *AI-assisted analysis only — not financial advice. Trading carries significant risk.*

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | "Top Trade" hero card with trust signals (signal age, primary risk, account suitability, potential loss), 4-step "what to do today" welcome strip, quality-sorted signals, account bar with multi-account switcher, market watch, expanded journal stats, recent lessons widget |
| **Market Watch** | Monitor 16 forex instruments with live prices, spread, volatility, multi-timeframe trends, and session data — column headers carry glossary tooltips, signal badges link directly to the signal detail |
| **Signal Explorer** | Browse algorithmically-generated trade setups with confidence scores, quality grades (A+/A/B/C), R:R ratios, age + staleness chips, suitability tags, AI explanations, "why this could fail" callouts, and recurring-mistake awareness |
| **Risk Calculator** | Position sizing with one-click presets (Beginner 1%/half · Standard 2% · Aggressive 3%), conservative mode, exposure warnings, daily loss tracking, glossary tooltips on every label, query-param pre-fill from any signal |
| **Take-Trade Dialog** | Live risk preview (potential loss in $, % of account, daily-budget used vs. cap), hard-block on over-cap submissions, conservative-mode override, per-session educational-not-advice acknowledgment |
| **Alerts Center** | Notifications for signal events and market conditions with severity levels (event-aware deduplication) |
| **Trade Journal** | Log trades with entry/exit, emotions, lessons learned, post-trade rule-engine analysis, recurring-mistake badges when an outcome reason repeats |
| **Pair Detail** | Deep-dive analysis per pair: live OHLCV chart, key levels, structure, AI reasoning, signal & journal history, per-toggle helper text on alert controls |
| **Live Charts** | Real candlestick charts (5m / 15m / 1H / 4H / 1D) with EMA overlays, on-chart entry/SL/TP price lines, and signal markers |
| **Data Freshness** | Auto-refresh on login, 2-minute polling, server-side cron scheduling, freshness badges across widgets, **global freshness pill in the header** that explains Live / Cached / No-data states on click |
| **Beginner Mode** | Triggered by `profile.experience_level === "beginner"`. Glossary tooltips on jargon (R:R, pip, lot, drawdown, leverage, etc.), longer-form explanations, calculator preset auto-applied, beginner-friendly badge on qualifying signals |
| **Broker Integration** | Read-only broker account sync (adapter pattern) — view positions, orders, equity snapshots without execution |
| **Settings** | Profile, preferred pairs/sessions/strategies, risk parameters, notifications |
| **Admin Review** | Role-based panel for reviewing and tagging AI-generated signals (quality control) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5 · Vite 5 |
| Styling | Tailwind CSS v3 · shadcn/ui (Radix) |
| Data | TanStack React Query v5 |
| Routing | React Router v6 |
| Charts | Recharts (stat widgets) · lightweight-charts v5 (live candlesticks) |
| Forms | React Hook Form · Zod |
| Backend | Supabase — PostgreSQL with RLS + Edge Functions (Deno runtime) |
| Market Data | Twelve Data API (live OHLCV, 8 credits/min free tier) |
| AI | Claude Haiku via Anthropic API (explanation layer only — versioned prompts) |
| Auth | Email/password with verification |
| Scheduling | pg_cron + pg_net (server-side Edge Function invocation) |
| Testing | Vitest (294 tests across pure engine + presentation modules) |

## Architecture

```
Frontend (React SPA)
  ├── Pages (Dashboard, Signals, Watchlist, Journal, Calculator, Alerts, Learn, Settings, Admin)
  ├── Hooks (use-signals, use-alerts, use-journal, use-watchlist, use-account,
  │          use-market-data, use-pip-value, use-daily-risk, use-candles,
  │          use-auto-refresh, use-broker, use-admin)
  ├── Contexts (AuthContext — session + profile)
  ├── Lib (pure, vitest-tested)
  │    ├── pip-value          — live-rate pip value computation
  │    ├── risk-engine        — position sizing, daily-loss caps, exposure
  │    ├── alert-engine       — event-aware alert evaluation + deduplication
  │    ├── explanation-service — versioned-prompt AI/template fallback
  │    ├── data-freshness    — Live/Cached/Demo classification + signal freshness
  │    ├── signal-presentation — beginner-friendly tag, account suitability, age, primary risk
  │    ├── glossary           — typed glossary of trading terms (short + long descriptions)
  │    ├── indicators         — EMA/RSI/ATR/MACD/BB
  │    └── chart-colors       — chart palette
  └── Components (chart, calculator, dashboard/WelcomeStrip, journal, signals, ui, …)

Backend (Supabase)
  ├── Tables: profiles, trading_accounts, user_risk_profiles, signals,
  │           pair_analyses, alerts, alert_state_log, trade_journal_entries,
  │           user_watchlist, instruments, market_data_cache, ohlcv_candles,
  │           generation_runs, indicator_snapshots, notification_deliveries,
  │           user_roles, admin_review_tags,
  │           broker_connections, synced_accounts, open_positions,
  │           pending_orders, account_snapshots, sync_logs
  ├── RLS policies on all tables (authenticated read, scoped writes)
  ├── Auth triggers (auto-create profile + account + risk profile on signup)
  ├── pg_cron schedules (market data every 5m, signals every 2h,
  │                      alerts every 5m, outcome resolution every hour)
  └── Edge Functions (Deno):
       ├── fetch-market-data    → pulls quotes from Twelve Data into market_data_cache
       ├── fetch-candles        → pulls OHLCV bars into ohlcv_candles (auto-fetched per pair)
       ├── generate-signals     → TA engine + Claude AI explanations
       │                         (batched at 2 pairs/invocation, audited via generation_runs)
       ├── evaluate-alerts      → walks open signals, fires entry/SL/TP/invalidation events
       ├── deliver-notifications → sends email + Telegram alerts for triggered events
       ├── resolve-live-outcomes → closes signals that hit TP/SL in live market data
       ├── run-backtest          → historical replay with R-multiple metrics
       └── sync-broker-data     → read-only broker account sync (MT5 adapter stub)

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

Data Freshness Pipeline
  Server-side: pg_cron triggers Edge Functions on schedule
    → fetch-market-data every 5 min
    → generate-signals every 2 hours (8 staggered batches)
    → evaluate-alerts every 5 min
    → resolve-live-outcomes every hour
  Client-side: auto-refresh on login (stale detection) + React Query polling
    → signals poll every 2 min, market data every 1 min, alerts every 1 min
    → candles auto-fetch on pair detail page visit
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
│   ├── data-freshness.ts   — Live/Cached/Demo classification + signal freshness
│   ├── indicators.ts       — EMA/RSI/ATR/MACD/BB
│   ├── chart-colors.ts     — chart palette
│   ├── broker/types.ts     — frontend broker type definitions
│   └── __tests__/          — vitest suites (113 tests)
├── pages/            # One file per route
├── types/            # Trading type definitions
└── integrations/     # Supabase client + types

supabase/
├── config.toml               # Function config (verify_jwt settings)
├── functions/
│   ├── _shared/              # Deno mirrors of pure modules + broker adapters
│   │   └── broker/           # Adapter pattern (types, factory, MT5 adapter,
│   │                         #   sync-service, credential-vault)
│   ├── fetch-market-data/    # Edge Function — Twelve Data quotes
│   ├── fetch-candles/        # Edge Function — Twelve Data OHLCV bars
│   ├── generate-signals/     # Edge Function — signal engine + AI explanations
│   ├── evaluate-alerts/      # Edge Function — alert event evaluation
│   ├── deliver-notifications/ # Edge Function — email + Telegram delivery
│   ├── resolve-live-outcomes/ # Edge Function — close signals at TP/SL
│   ├── run-backtest/         # Edge Function — historical replay
│   └── sync-broker-data/    # Edge Function — read-only broker sync
└── migrations/               # SQL migrations (tables, RLS, FKs, indexes, cron)
```

## What's Implemented

- ✅ Full auth flow (signup, login, email verification, password reset, onboarding)
- ✅ Dashboard with "Top Trade" hero card, quality-sorted signals, account bar, market watch
- ✅ **Live market data** for 16 instruments via Twelve Data Edge Function
- ✅ **Live pip-value computation** from real exchange rates (JPY, USD-quote, USD-base, crosses, XAU)
- ✅ **Deterministic signal engine** — indicators, 5 setup patterns, confluence scoring, quality grades
- ✅ **Live candlestick charts** (5m / 15m / 1H / 4H / 1D) with EMA overlays, on-chart entry/SL/TP price lines
- ✅ **Risk engine v2** — pure module, daily loss caps, exposure warnings, vitest-covered
- ✅ **Alert engine v2** — event-aware deduplication via `alert_state_log`, vitest-covered
- ✅ **Explanation hardening** — versioned prompts, AI/template fallback metadata persisted per row, per-run AI counters
- ✅ **Frontend real-data conversion** — Live/Cached/Demo badges across Dashboard, Watchlist, PairDetail, SignalDetail
- ✅ **Backtest engine** — deterministic historical replay with R-multiple metrics
- ✅ **Signal analytics** — equity curve, confidence calibration, live outcome resolver
- ✅ **Automated notifications** — email + Telegram delivery for triggered alerts
- ✅ **Data freshness pipeline** — server-side pg_cron scheduling, client-side auto-refresh + polling, freshness badges
- ✅ **Dashboard redesign** — Top Trade hero card, quality-sorted signals, collapsible sections
- ✅ **Read-only broker integration** — adapter pattern, 6 DB tables, sync service, credential encryption (MT5 stub)
- ✅ **Chart rendering fix** — always-mounted chart container prevents lifecycle race condition
- ✅ Daily risk tracker on dashboard, summed from today's open journal entries
- ✅ Signal explorer with 6 filters, R:R column, quality badges, freshness indicators
- ✅ Risk calculator with conservative mode and exposure warnings
- ✅ Trade journal with CRUD, stats, and filtering
- ✅ Learn hub (7 sections) with glossary and FAQ search
- ✅ Settings with profile, preferences, risk params, notifications
- ✅ Admin review panel (role-based)
- ✅ **UX Improvement Plan v1** (8 phases) — signal trust layer, risk-before-trade safety, beginner mode, dashboard guided flow, journal learning loop, navigation glue, disclaimer placement, architecture polish — see [UX_IMPROVEMENT_PLAN.md](docs/UX_IMPROVEMENT_PLAN.md)
- ✅ Error boundary + strict null checks + FK constraints with CASCADE
- ✅ Dark-first glassmorphic UI
- ✅ **294 vitest tests** across pure engine + presentation modules

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
| 10 | Backtest + replay foundation (deterministic historical replay, R-multiple metrics) — see [BACKTEST_ENGINE.md](BACKTEST_ENGINE.md) | ✅ Done |
| 11 | Signal analytics & review (equity curve, confidence calibration, no-trade quality, live outcome resolver) — see [SIGNAL_ANALYTICS.md](SIGNAL_ANALYTICS.md) | ✅ Done |
| 12 | Automated outbound alert delivery (email + Telegram) | ✅ Done |
| 14 | Read-only broker integration (adapter pattern, sync service, credential vault) — see [BROKER_INTEGRATION_READONLY.md](docs/BROKER_INTEGRATION_READONLY.md) | ✅ Done |
| 15 | Data freshness pipeline (pg_cron scheduling, auto-refresh, polling, freshness indicators) | ✅ Done |
| 16 | Dashboard redesign (Top Trade hero, quality sorting, compact layout) | ✅ Done |
| 17 | Chart fix (always-mount container, Supabase types for candle tables, JWT config) | ✅ Done |
| 18 | Trade execution flow + post-trade rule analysis + trade analytics (sub-phases 18.1–18.10) | ✅ Done |
| **UX v1** | Signal trust layer, risk-before-trade safety, beginner mode, dashboard guided flow, journal learning loop, navigation glue, disclaimer placement, architecture polish — see [docs/UX_IMPROVEMENT_PLAN.md](docs/UX_IMPROVEMENT_PLAN.md) | ✅ Done |

## Future Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 19** | Confidence recalibration (only if analytics calibration data justifies it) |
| **Phase 20** | Lift the UX v1 client-side heuristics (`signal-presentation`) into the Edge Function as `pair_analyses` columns once they prove out against real journal data |
| **Phase 21** | Broker execution layer (optional, requires full security audit) |

## Documentation

Full documentation suite available in `/docs/`:
- **`SYSTEM_ARCHITECTURE.md`** — End-to-end technical architecture (pipeline, Edge Functions, signal engine, AI layer, tables, data flow)
- **`UX_IMPROVEMENT_PLAN.md`** — 8-phase UX v1 plan (trust signals, beginner mode, learning loop) and what each phase shipped
- `USER_GUIDE.md` — Beginner-friendly walkthrough
- `FEATURES_SPEC.md` — Detailed feature breakdown
- `DATABASE_SCHEMA.md` — All tables, fields, RLS policies
- `API_CONTRACTS.md` — Supabase query contracts
- `SIGNAL_ENGINE_SPEC.md` — Original signal engine design spec
- `RISK_ENGINE_SPEC.md` — Position sizing and exposure formulas
- `ALERT_ENGINE_SPEC.md` — Alert types, triggers, delivery
- `UI_ARCHITECTURE.md` — Frontend structure and data flow
- `BROKER_INTEGRATION_READONLY.md` — Broker adapter architecture & security model
- `BACKTEST_ENGINE.md` — Historical replay engine design
- `SIGNAL_ANALYTICS.md` — Signal performance analytics

## Deployment

Environment variables required:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — in `.env` for the frontend

Supabase Edge Function secrets:
- `TWELVE_DATA_API_KEY` — for market data and candle fetching
- `ANTHROPIC_API_KEY` — for AI explanations (optional; falls back to templates)
- `BROKER_CREDENTIAL_KEY` — for broker credential encryption (optional, only if using broker sync)

Deploy Edge Functions (all require `--no-verify-jwt` for frontend invocation):
```bash
supabase functions deploy fetch-market-data --no-verify-jwt
supabase functions deploy fetch-candles --no-verify-jwt
supabase functions deploy generate-signals --no-verify-jwt
supabase functions deploy evaluate-alerts --no-verify-jwt
supabase functions deploy deliver-notifications --no-verify-jwt
supabase functions deploy resolve-live-outcomes --no-verify-jwt
supabase functions deploy run-backtest --no-verify-jwt
supabase functions deploy sync-broker-data --no-verify-jwt
```

Apply database migrations:
```bash
supabase db push
```

Invoke signal generation (batched, 2 pairs per invocation, batches 0–7):
```bash
curl -X POST "https://<project>.supabase.co/functions/v1/generate-signals?batch=0" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"
```

Manually fetch candles for a pair:
```bash
curl -X POST "https://<project>.supabase.co/functions/v1/fetch-candles" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EUR/USD","timeframe":"1h"}'
```

## License

Private project. All rights reserved.
