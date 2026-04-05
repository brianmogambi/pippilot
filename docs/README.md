# PipPilot AI — System Overview

## Product Name

**PipPilot AI** — AI-Assisted Forex Analysis Platform

## What It Does

PipPilot AI is a web-based trading companion that provides AI-generated forex market analysis, trade signal suggestions, risk management tools, and a trade journal. It is designed to help retail forex traders — especially beginners and intermediates — make more informed trading decisions by surfacing structured analysis and enforcing disciplined risk management.

**PipPilot AI is NOT an auto-trading system.** It does not execute trades, connect to brokers, or manage positions. It is a decision-support tool.

## Core Purpose

- Surface AI-generated trade setups with structured reasoning (pros, cons, invalidation criteria)
- Enforce risk-first thinking through position sizing tools and daily loss limits
- Provide transparency into every signal — including "No Trade" verdicts when conditions are unfavorable
- Help traders build discipline through journaling and performance tracking

## Key Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Account overview, active signals, alerts feed, market watch, journal snapshot, daily trading tip |
| **Market Watch (Watchlist)** | Monitor forex instruments with real-time mock data — price, spread, volatility, trend direction, session, and active signals |
| **Pair Detail** | Deep-dive into a specific pair: multi-timeframe analysis, key levels, market structure, AI analysis, signal history, and journal entries |
| **Signal Explorer** | Browse, filter, and analyze AI-generated trade setups with confidence scores, quality ratings, and detailed reasoning |
| **Risk Calculator** | Position size calculator with account balance, risk percentage, SL distance, conservative mode, and exposure warnings |
| **Alerts Center** | View and manage triggered alerts linked to signals — severity levels, read/unread status, and dismissal |
| **Trade Journal** | Log trades with entry/exit prices, lot size, result pips, emotional notes, lessons learned, and plan adherence tracking |
| **Settings** | Profile, trading preferences (pairs, sessions, strategies, timeframes), risk parameters, notification channels |
| **Admin Review** | Admin-only panel for reviewing and tagging AI-generated signals and alerts (quality control) |
| **Authentication** | Email/password signup and login with email verification, password reset flow, and onboarding wizard |

## Target Users

1. **Beginner forex traders** — Need guidance, education, and guardrails to avoid common mistakes
2. **Intermediate traders** — Want structured analysis and risk management tools to supplement their own analysis
3. **Trading educators** — Can use the platform to demonstrate signal analysis and risk management concepts

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│   React 18 + Vite 5 + TypeScript 5 + Tailwind   │
│   shadcn/ui components + Recharts               │
│   TanStack React Query for data fetching        │
│   React Router v6 for routing                   │
├─────────────────────────────────────────────────┤
│                  Backend (Supabase)              │
│   Supabase PostgreSQL database                   │
│   Row-Level Security (RLS) on all tables         │
│   Auth (email/password with verification)        │
│   Edge Functions (for future signal engine)       │
│   Auto-provisioned on signup (trigger-based)     │
├─────────────────────────────────────────────────┤
│              Data Layer (MVP)                    │
│   Mock market data (static, in-memory)           │
│   Mock pair analysis (static, in-memory)         │
│   Real DB for: signals, alerts, journal,         │
│   profiles, watchlist, accounts, risk profiles   │
└─────────────────────────────────────────────────┘
```

## Key Principles

1. **Risk-First** — Every feature encourages capital preservation. Position sizing, daily loss limits, conservative mode, and exposure warnings are built into the core experience.
2. **Transparency** — Every signal includes full reasoning (pros and cons), invalidation criteria, and a confidence score. "No Trade" is a valid and encouraged output.
3. **No Guarantees** — Disclaimers are present throughout the app. PipPilot AI provides analysis, not financial advice.
4. **Education-Oriented** — Beginner-friendly explanations accompany every signal. Daily trading tips rotate on the dashboard.
5. **Progressive Disclosure** — Beginners see simplified views; advanced users can access full analysis details.

## MVP Scope (V1)

### Included in V1
- Full authentication flow (signup, login, email verification, password reset, onboarding)
- Dashboard with account overview, signals, alerts, market watch, journal snapshot
- Market Watch with 15 instruments (majors, minors, XAU/USD)
- Pair Detail pages with multi-timeframe analysis
- Signal Explorer with 6 filters and detail drawer
- Risk Calculator with position sizing, conservative mode, exposure warnings
- Alerts Center with CRUD operations
- Trade Journal with entry form, stats, and detail drawer
- Settings page with profile, preferences, risk parameters, notifications
- Admin Review panel (role-based access)
- Dark-first glassmorphic UI with card-based layout

### NOT in V1 (Future)
- Real-time market data feeds (currently mock)
- AI signal generation engine (signals currently inserted manually or via admin)
- Broker integration (trade execution)
- Push notifications / email / Telegram alerts
- Advanced analytics and equity curve charting
- Social/community features
- Mobile native app

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 with TypeScript 5 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS v3 + tailwindcss-animate |
| UI Components | shadcn/ui (Radix primitives) |
| Charts | Recharts |
| Routing | React Router v6 |
| Data Fetching | TanStack React Query v5 |
| Forms | React Hook Form + Zod validation |
| Backend | Supabase (self-hosted project) |
| Database | PostgreSQL with RLS |
| Auth | Supabase Auth (email/password) |
| Deployment | Vite static build + Supabase Edge Functions |

## How the System Is Intended to Evolve

### Signal Engine (Phase 2)
Currently, signals are static DB rows inserted manually. The planned signal engine will:
- Ingest OHLCV data from market data APIs
- Run multi-timeframe technical analysis (trend, structure, key levels)
- Detect setup patterns (flag breakouts, S/R rejections, trend pullbacks)
- Score confluence and confidence
- Output structured signal objects with full reasoning
- Implemented as Supabase Edge Functions triggered on schedule

### Risk Engine (Phase 2)
The calculator currently uses simplified pip value assumptions. The planned risk engine will:
- Fetch real-time exchange rates for accurate pip value conversion
- Track open positions for cumulative exposure monitoring
- Enforce daily drawdown limits server-side
- Integrate with the signal engine for automatic position sizing suggestions

### Alerts Engine (Phase 3)
Currently, alerts are manually created. The planned alerts engine will:
- Auto-generate alerts when signal conditions are met
- Support price-level, indicator, and news-based triggers
- Deliver via in-app, email, push, and Telegram channels
- Include deduplication and rate limiting
