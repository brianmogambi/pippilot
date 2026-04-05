# PipPilot AI — System Architecture

End-to-end technical documentation of the PipPilot AI forex analysis platform. This document describes the **implemented** system (as of 2026-04-05, all 5 migration steps complete).

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Signal Generation Pipeline](#signal-generation-pipeline)
4. [Market Data Pipeline](#market-data-pipeline)
5. [Technical Indicators Library](#technical-indicators-library)
6. [Deterministic Signal Engine](#deterministic-signal-engine)
7. [AI Explanation Layer](#ai-explanation-layer)
8. [Pip Value & Risk Computation](#pip-value--risk-computation)
9. [Database Schema](#database-schema)
10. [Frontend Data Flow](#frontend-data-flow)
11. [Edge Functions Reference](#edge-functions-reference)
12. [Security & RLS](#security--rls)
13. [Deployment & Secrets](#deployment--secrets)

---

## System Overview

PipPilot AI is a decision-support tool for retail forex traders. It performs multi-timeframe technical analysis on 16 forex instruments, detects trading setups using deterministic rules, scores confidence from confluence factors, and presents trade ideas with AI-written explanations. **It does not place trades and does not guarantee outcomes.**

**Core design principles:**

- **Deterministic math, AI narration.** Scores, levels, and verdicts are computed by rule-based code. Claude AI writes explanations only — it cannot change numbers.
- **Graceful degradation.** Every layer (market data, pip values, AI explanations, analyses) has a static fallback so the UI never breaks if a downstream service fails.
- **Risk-first UX.** Position sizing, daily risk budgets, and exposure warnings are first-class features.
- **Transparency.** Every signal shows full reasoning, reasons-for/against, and invalidation criteria.

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind + shadcn/ui |
| State | TanStack React Query v5 |
| Routing | React Router v6 |
| Backend | Supabase (Postgres + RLS + Edge Functions on Deno) |
| Market Data | Twelve Data API (free tier: 8 credits/min, 800/day) |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Auth | Supabase Auth (email/password + verification) |

---

## High-Level Architecture

```
                          ┌──────────────────────────────┐
                          │         Browser (SPA)        │
                          │  React + TanStack Query      │
                          └──────────────┬───────────────┘
                                         │ supabase-js
                                         ▼
                       ┌────────────────────────────────┐
                       │        Supabase (Postgres)     │
                       │  - Tables + RLS policies       │
                       │  - Auth + triggers             │
                       └───────┬───────────────┬────────┘
                               │               │
             invoked by user   │               │  scheduled / on-demand
                               ▼               ▼
                    ┌──────────────────┐   ┌──────────────────────┐
                    │ Supabase Auth    │   │   Edge Functions     │
                    │ (JWT + RLS)      │   │  (Deno runtime)      │
                    └──────────────────┘   │                      │
                                           │ ┌──────────────────┐ │
                                           │ │ fetch-market-data│ │──▶ Twelve Data API
                                           │ └──────────────────┘ │
                                           │ ┌──────────────────┐ │
                                           │ │ generate-signals │ │──▶ Twelve Data API
                                           │ │  (+ AI layer)    │ │──▶ Anthropic API
                                           │ └──────────────────┘ │
                                           └──────────────────────┘
```

- **Browser** talks only to Supabase (Postgres via RLS, plus direct Edge Function invocations).
- **Edge Functions** talk to Twelve Data and Anthropic on the server side; API keys never touch the client.
- **Database** is the single source of truth — hooks query tables, Edge Functions write to them.

---

## Signal Generation Pipeline

End-to-end flow of how a real trade signal is produced:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    generate-signals Edge Function                    │
│                                                                      │
│  1. Fetch OHLCV from Twelve Data                                     │
│     • H1 × 200 candles, H4 × 100 candles, D1 × 60 candles           │
│     • 2 pairs per batch (fits in 8 credits/min rate limit)          │
│                                                                      │
│  2. Compute indicators per timeframe                                 │
│     • EMA(20), EMA(50), EMA(200), RSI(14), ATR(14)                  │
│     • MACD(12,26,9), Bollinger Bands(20, 2σ)                        │
│     • Trend classification: bullish / bearish / neutral             │
│                                                                      │
│  3. Classify market structure                                        │
│     • trending / ranging / breakout (from BB width + trend align)   │
│                                                                      │
│  4. Detect setup patterns (5 types, pick strongest)                  │
│     • Trend Pullback, Breakout Retest, Range Reversal,              │
│       Momentum Breakout, S/R Rejection                              │
│                                                                      │
│  5. Score confluence (0–100)                                         │
│     • Base 50, adjusted by alignment, structure, EMA, RSI, MACD,    │
│       key levels, session, penalties for conflict/overextension     │
│                                                                      │
│  6. Compute entry / SL / TP levels                                   │
│     • Entry from EMA zone (pullbacks) or market (breakouts)         │
│     • SL from ATR buffer + structure                                 │
│     • TP1 = 1.5R, TP2 = 2.5R, TP3 = 4R                              │
│                                                                      │
│  7. Grade quality + determine verdict                                │
│     • A+ ≥80, A ≥65, B ≥50, C <50                                   │
│     • No-trade if conf<45 or alignment=0 or R:R<1.2                 │
│                                                                      │
│  8. AI explanation (Claude Haiku)                                    │
│     • Rewrites beginner/expert text + reasons for/against           │
│     • Falls back to templates if API fails                          │
│                                                                      │
│  9. Database writes                                                  │
│     • Expire old active signals for this pair                       │
│     • Insert into signals (with ai_reasoning, levels, confidence)   │
│     • Insert into pair_analyses (explanations, reasons, verdict)    │
└─────────────────────────────────────────────────────────────────────┘
```

**Batching:** 16 pairs are split into 8 batches of 2 pairs each (`?batch=0..7`). Each batch makes 6 API calls (2 pairs × 3 timeframes), which fits inside Twelve Data's 8-credit-per-minute free-tier window without any rate-limit wait. Total runtime per batch: ~20–40s (well under the Supabase Edge Function wall-clock limit).

---

## Market Data Pipeline

Separate from signal generation, the `fetch-market-data` Edge Function keeps the `market_data_cache` table refreshed with real quotes and summary metadata:

- Pulls current quotes (bid/ask/spread) for all 16 pairs from Twelve Data.
- Computes volatility and daily % change from recent candles.
- Writes to `market_data_cache` keyed by pair.
- Frontend hooks (`useAllMarketData`, `useMarketSummary`) read from this table.

When `generate-signals` runs, it **also** updates the trend fields (`trend_h1`, `trend_h4`, `trend_d1`) and market structure in `market_data_cache` with values computed during signal analysis.

---

## Technical Indicators Library

Location: `supabase/functions/_shared/indicators.ts`

Pure functions, no state, all operate on arrays where index 0 is oldest:

| Function | Description |
|----------|-------------|
| `sma(data, period)` | Simple Moving Average |
| `ema(data, period)` | Exponential Moving Average (SMA-seeded) |
| `rsi(closes, period)` | Relative Strength Index, Wilder's smoothing |
| `atr(highs, lows, closes, period)` | Average True Range |
| `macd(closes, fast, slow, signal)` | MACD line, signal line, histogram |
| `bollingerBands(closes, period, stdDev)` | Upper, middle, lower bands |
| `lastValid(arr)` | Last non-NaN value |
| `lastNValid(arr, n)` | Last N non-NaN values |

These are reused by both `generate-signals` and any future analytics functions.

---

## Deterministic Signal Engine

Location: `supabase/functions/_shared/signal-engine.ts`

### Trend Detection

For each timeframe, classify as `bullish`, `bearish`, or `neutral` based on EMA alignment:

- **Bullish:** `price > EMA20 > EMA50 > EMA200`
- **Bearish:** `price < EMA20 < EMA50 < EMA200`
- **Neutral:** mixed alignment

### Market Structure

Classified from H4 Bollinger Band width and H4/D1 trend agreement:

- **Trending:** narrow BB + H4 trend matches D1 trend
- **Ranging:** very narrow BB (<1.5%) without directional trend
- **Breakout:** wide BB relative to recent history

### Setup Patterns (5 types)

| Pattern | Conditions |
|---------|-----------|
| **Trend Pullback** | H4/D1 trending + H1 pulled back to EMA20/50 + RSI between 40–60 |
| **Breakout Retest** | Price broke prior 20-candle high/low and returned within 2×ATR |
| **Range Reversal** | Ranging structure (BB<1.5%) + RSI ≤30 or ≥70 + at BB band |
| **Momentum Breakout** | Strong directional candle (body > 1.5×ATR) + EMA alignment |
| **S/R Rejection** | Rejection candle (long wick > 2× body) + near S/R |

All detected setups are sorted by strength; the strongest wins.

### Confluence Scoring

Base score: 50. Adjustments:

| Factor | Delta |
|--------|-------|
| 3-timeframe alignment | +15 |
| 2-timeframe alignment | +8 |
| 0-timeframe alignment | −10 |
| Structure matches setup | +10 |
| EMA alignment (H1) | +5 |
| RSI in 40–60 band | +5 |
| RSI oversold/overbought extreme (aligned) | +3 |
| MACD histogram confirms direction | +5 |
| Near key level (S or R within 2×ATR) | +5 |
| Setup pattern strength (0–1) | +0..5 |
| London/NY session active | +3 |
| Overextended (RSI>75 long or <25 short) | −8 |
| ≥2 timeframes opposing direction | −10 |

Final score clamped to `[0, 100]`.

### Quality Grades

```
A+  confidence ≥ 80
A   confidence ≥ 65
B   confidence ≥ 50
C   confidence < 50
```

### Verdict Logic

Returns `"no_trade"` with a reason if any of:
- Confidence < 45
- Zero timeframe alignment
- R:R < 1.2

Otherwise returns `"trade"`.

### Level Computation

- **Entry** — market price, or EMA20 (for trend pullbacks)
- **Stop Loss** — 1.5×ATR from entry (tightened to EMA50 ± ATR for pullbacks)
- **TP1** — entry ± 1.5R
- **TP2** — entry ± 2.5R
- **TP3** — entry ± 4R
- **Entry Zone** — entry ± 0.3×ATR

Pair-specific rounding: 2 decimals (XAU/USD), 3 decimals (JPY pairs), 5 decimals (others).

---

## AI Explanation Layer

Location: `supabase/functions/generate-signals/index.ts`

**Constraint:** AI explains, it does not decide. The deterministic engine owns all numerical outputs — confidence, levels, verdict. The AI only rewrites text fields.

### Model & Configuration

- **Model:** `claude-haiku-4-5-20251001`
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Max tokens:** 512
- **Timeout:** 10s (via `AbortController`)

### Prompt Structure

The system prompt enforces four rules:

1. Explain only — never modify scores, confidence, verdict, or levels.
2. Beginner: 2–4 sentences, plain language, no jargon.
3. Expert: 2–4 sentences, reference indicators and multi-timeframe data.
4. Reasons for: 3–6 bullets. Reasons against: 2–4 bullets. No-trade reason: 1–2 sentences if applicable.

The user message is a JSON-serialized context object containing: pair, direction, setup type, timeframe, confidence, quality, verdict, entry/SL/TPs, trends (H1/H4/D1), market structure, support/resistance levels.

### Structured Text Response

The model is asked to respond in a fixed format:

```
BEGINNER:
<text>
EXPERT:
<text>
REASONS_FOR:
- <bullet>
- <bullet>
REASONS_AGAINST:
- <bullet>
- <bullet>
NO_TRADE_REASON:
<text or N/A>
```

The response is parsed with simple line splitting. JSON/tool-use mode was avoided to minimize token overhead.

### Fallback Behavior

| Failure | Result |
|---------|--------|
| `ANTHROPIC_API_KEY` not set | Log warning, skip AI, keep template text |
| API returns non-200 | Log error, keep template text |
| API timeout (10s) | Log error, keep template text |
| Response missing required sections | Log warning, keep template text |

Template explanations are generated deterministically as part of `analyzeForSignal()`, so every SignalOutput always has baseline text even before AI runs.

### Cost

- ~800 tokens per signal (input + output)
- Practical load: ~20–30 signals/day across all runs
- Haiku pricing: well under $0.05/day

---

## Pip Value & Risk Computation

Location: `src/lib/pip-value.ts`

Unified formula (pip value in USD):

```
pipValueUSD = pipSize × lotSize × quoteToUSDRate
```

Handles all pair types:

| Pair Type | Example | Formula |
|-----------|---------|---------|
| USD-quoted | EUR/USD, GBP/USD | `pipSize × 100000` → $10 per standard lot |
| USD-base | USD/JPY, USD/CAD | `(pipSize × 100000) / price` |
| JPY cross | EUR/JPY, GBP/JPY | `(pipSize × 100000) / USD/JPY rate` |
| Non-JPY cross | EUR/GBP, EUR/AUD | `(pipSize × 100000) / quote/USD rate` |
| XAU/USD | Gold | `0.01 × 100` = $1.00 per pip per 1 oz |

### Hook Layer

- `usePipValue(pair)` → `{ pipValue, isLive }` — single-pair
- `usePipValues()` → `{ getPipValue, isLive }` — batch getter

Both fall back to `getDefaultPipValueUSD()` when live market data is unavailable. UI indicates `"live"` vs `"est."` accordingly.

### Daily Risk Tracker

Location: `src/hooks/use-daily-risk.ts`

Computes the % of account balance committed to today's open journal entries:

```ts
riskUsd = Σ (lot_size × |entry_price - stop_loss| × pipMultiplier(pair) × pipValueUSD(pair))
riskUsedPct = (riskUsd / account.balance) × 100
```

Filters: `user_id = current_user AND status = 'open' AND created_at >= today_midnight_local`.

The dashboard "Risk Used Today" card uses this hook.

---

## Database Schema

Key tables (see `docs/DATABASE_SCHEMA.md` for full column lists):

| Table | Purpose |
|-------|---------|
| `profiles` | User profile (name, timezone, preferences) |
| `trading_accounts` | Balance, equity, currency, leverage |
| `user_risk_profiles` | risk_per_trade_pct, max_daily_loss_pct, conservative_mode |
| `instruments` | Tradable instrument metadata (16 pairs) |
| `market_data_cache` | Latest quotes, trends, structure per pair |
| `signals` | Active/expired signals with entry/SL/TP/confidence/ai_reasoning |
| `pair_analyses` | Per-signal explanations, reasons, verdict |
| `alerts` | User-scoped alerts with severity |
| `trade_journal_entries` | User-logged trades with outcomes |
| `user_watchlist` | User's favorited pairs |
| `user_roles` | Role assignments for admin panel |
| `admin_review_tags` | Admin quality-control tags on signals |

### Key Constraints (migration `20260404130000`)

- **FK CASCADE** on `trading_accounts.user_id`, `user_risk_profiles.user_id`, `trade_journal_entries.user_id` → user deletion cleans up owned rows.
- **Partial unique index** ensures one `is_default = true` account per user.
- **Performance indexes** on `user_id`, `pair`, `status`, `is_read` columns.

### pair_analyses (migration `20260404140000`)

```sql
create table pair_analyses (
  id uuid primary key,
  signal_id uuid references signals(id) on delete cascade,
  pair text,
  setup_type text,
  direction text check (direction in ('long','short')),
  entry_zone_low numeric, entry_zone_high numeric,
  stop_loss numeric, tp1 numeric, tp2 numeric, tp3 numeric,
  confidence integer check (confidence between 0 and 100),
  setup_quality text check (setup_quality in ('A+','A','B','C')),
  invalidation text,
  beginner_explanation text,
  expert_explanation text,
  reasons_for text[],
  reasons_against text[],
  no_trade_reason text,
  verdict text check (verdict in ('trade','no_trade')),
  created_at timestamptz
);
```

---

## Frontend Data Flow

```
supabase-js  ──▶  React Query hooks  ──▶  React components  ──▶  DOM
                       │
                       ├── staleTime caching
                       ├── automatic refetch on focus/reconnect
                       └── fallback mocks on empty/error
```

**Hooks (src/hooks/)**:

| Hook | Tables/Sources | Fallback |
|------|----------------|----------|
| `useSignals`, `useActiveSignals` | `signals` + `pair_analyses` | mock signals |
| `usePairAnalysis(symbol)` | `pair_analyses` | `getMockPairAnalysis` |
| `useAllMarketData`, `useMarketSummary` | `market_data_cache` | mock market data |
| `usePipValue`, `usePipValues` | `useAllMarketData` + pip-value lib | static defaults |
| `useDailyRiskUsed` | `trade_journal_entries` + account | returns 0 |
| `useAlerts`, `useDashboardAlerts`, `useUnreadAlertCount` | `alerts` | empty arrays |
| `useJournalEntries`, `useDashboardJournal`, `useDashboardJournalStats` | `trade_journal_entries` | empty arrays |
| `useWatchlist`, `useDashboardWatchlist` | `user_watchlist` | empty arrays |
| `useTradingAccount`, `useRiskProfile` | `trading_accounts`, `user_risk_profiles` | defaults |
| `useMarketData` (admin) | `market_data_cache` | empty |

All user-scoped queries include explicit `.eq("user_id", user!.id)` filters in addition to RLS — defense in depth.

**Error boundary**: `src/components/ErrorBoundary.tsx` wraps the entire app and shows a recovery screen if any render throws.

---

## Edge Functions Reference

### `fetch-market-data`

- **Trigger:** Scheduled (cron or manual invocation)
- **Purpose:** Keep `market_data_cache` fresh with live quotes
- **Secrets:** `TWELVE_DATA_API_KEY`
- **Writes:** `market_data_cache` table

### `generate-signals`

- **Trigger:** On-demand via HTTP POST with `?batch=N` query param
- **Purpose:** TA analysis + signal generation + AI explanation
- **Secrets:** `TWELVE_DATA_API_KEY`, `ANTHROPIC_API_KEY` (optional)
- **Writes:** `signals` (new rows, expires old for same pair), `pair_analyses` (one row per new signal), updates `market_data_cache` trends
- **Batches:** 8 batches (0–7) of 2 pairs each

**Sample invocation:**

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/generate-signals?batch=0" \
  -H "Authorization: Bearer <anon-key>"
```

**Sample response:**

```json
{
  "success": true,
  "batch": "0",
  "generated": 2,
  "signals": [
    { "pair": "EUR/USD", "direction": "short", "confidence": 89,
      "quality": "A+", "verdict": "trade", "setup": "Trend Pullback" },
    { "pair": "GBP/USD", "direction": "short", "confidence": 89,
      "quality": "A+", "verdict": "trade", "setup": "Trend Pullback" }
  ],
  "skipped": [],
  "timestamp": "2026-04-05T04:37:41.469Z"
}
```

---

## Security & RLS

- **Supabase RLS** enforces per-user access on all user-scoped tables (profiles, trading_accounts, user_risk_profiles, alerts, trade_journal_entries, user_watchlist).
- **Global tables** (signals, pair_analyses, market_data_cache, instruments) have read-only access for authenticated users; writes are restricted to `service_role` (Edge Functions).
- **Admin tables** use the `user_roles` table + Postgres role-check policies.
- **Secrets** are stored as Supabase Edge Function secrets, never exposed to the client.
- **strictNullChecks** enabled in `tsconfig` — the type system catches null-safety bugs at compile time.

---

## Deployment & Secrets

### Frontend `.env`

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

### Edge Function secrets

```bash
supabase secrets set TWELVE_DATA_API_KEY=<key>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-<key>
```

### Deploy

```bash
# Push database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy fetch-market-data
supabase functions deploy generate-signals

# Manually invoke signal generation (batches 0–7)
curl -X POST "https://<project>.supabase.co/functions/v1/generate-signals?batch=0" \
  -H "Authorization: Bearer <anon-key>"
```

### Scheduled Invocation

To run signal generation every 4 hours across all 8 batches, schedule 8 staggered cron jobs (space them 60+ seconds apart to respect the Twelve Data rate limit), or call sequentially from a single scheduled task that waits between batches.

---

## Appendix: File Map

| Concern | Files |
|---------|-------|
| **TA indicators** | `supabase/functions/_shared/indicators.ts` |
| **Signal engine** | `supabase/functions/_shared/signal-engine.ts` |
| **Signal Edge Function** | `supabase/functions/generate-signals/index.ts` |
| **Market data Edge Function** | `supabase/functions/fetch-market-data/index.ts` |
| **Pip value library** | `src/lib/pip-value.ts` |
| **Pip value hooks** | `src/hooks/use-pip-value.ts` |
| **Daily risk hook** | `src/hooks/use-daily-risk.ts` |
| **Signal hooks** | `src/hooks/use-signals.ts` |
| **Market data hooks** | `src/hooks/use-market-data.ts` |
| **Risk calculator UI** | `src/components/calculator/RiskCalculator.tsx` |
| **Signal detail UI** | `src/components/signals/SignalDetailDrawer.tsx` |
| **Dashboard** | `src/pages/Index.tsx` |
| **Error boundary** | `src/components/ErrorBoundary.tsx` |
| **FK + indexes migration** | `supabase/migrations/20260404130000_add_fk_constraints_and_indexes.sql` |
| **pair_analyses migration** | `supabase/migrations/20260404140000_create_pair_analyses.sql` |
| **market_data_cache migration** | `supabase/migrations/20260404120000_create_market_data_cache.sql` |
