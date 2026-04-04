# PipPilot AI — Mock Usage Report

**Date**: 2026-04-04
**Commit**: `b9ccc17` (main)
**Purpose**: Document every mock data source, fake calculation, and hardcoded value in the codebase.

---

## 1. Mock Data Files

### `src/data/mockMarketData.ts` (205 lines)

**Exports**:

| Export | Type | Lines | Description |
|--------|------|-------|-------------|
| `mockMarketData` | `Record<string, MarketData>` | 49–65 | 14 forex instruments with hardcoded price, spread, dailyChange, ATR, volatility, trends (H1/H4/D1), session, news risk, S/R levels, session high/low, prev day high/low, market structure |
| `mockPairAnalysis` | `Record<string, PairAnalysis>` | 67–176 | 6 pair analyses (EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, EUR/CHF) with setup type, entry zone, SL/TP levels, confidence, quality grade, beginner/expert explanations, reasons for/against, verdict |
| `getMarketData(symbol)` | function | 178–200 | Returns mock data for symbol or zeroed fallback |
| `getPairAnalysis(symbol)` | function | 202–204 | Returns mock analysis or null |

**Type definitions also exported** (lines 1–47): `TrendDirection`, `VolatilityLevel`, `SessionName`, `MarketStructure`, `SetupQuality`, `Verdict`, `MarketData`, `PairAnalysis`

**Instruments with mock data** (14):
EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, EUR/CHF, XAU/USD

**Pairs with analysis** (6 of 14):
EUR/USD, GBP/USD, USD/JPY, USD/CHF, XAU/USD, EUR/CHF

---

### `src/data/mockSignals.ts` (262 lines)

**Exports**:

| Export | Type | Lines | Description |
|--------|------|-------|-------------|
| `mockSignals` | `Signal[]` | 19–76 | 8 hardcoded trade signals with entry/SL/TP, confidence (38–88%), ai_reasoning text, status, setup_type |
| `watchlistPairs` | `string[]` | 78 | 7 hardcoded pair names |
| `mockAlerts` | `Alert[]` | 90–98 | 7 hardcoded alerts with conditions and statuses |
| `mockAccountStats` | object | 101–113 | Single hardcoded account: balance $12,480, equity $12,635, daily P/L $155, etc. |
| `mockNotifications` | `Notification[]` | 123–130 | 6 hardcoded notifications |
| `mockJournalEntries` | `JournalEntry[]` | 151–222 | 10 fake trades (Mar 24 – Apr 2, 2026) with P/L, R:R, notes |
| `mockMarketSummary` | `MarketPair[]` | 233–242 | 8 pairs with price, change, sentiment |
| `mockWatchlistData` | `WatchlistPair[]` | 253–261 | 7 pairs with price, daily change, signal status |

**Type definitions also exported**: `Signal`, `Alert`, `Notification`, `JournalEntry`, `MarketPair`, `WatchlistPair`

---

## 2. Mock Consumers — Hooks

### `src/hooks/use-market-data.ts` (19 lines) — ENTIRELY MOCK

```
Line 1:  import { getMarketData, getPairAnalysis } from "@/data/mockMarketData";
Line 2:  import { mockMarketSummary } from "@/data/mockSignals";
```

| Function | Returns | Backend calls |
|----------|---------|---------------|
| `useMarketData(symbol)` | `getMarketData(symbol)` — static mock object | None |
| `usePairAnalysis(symbol)` | `getPairAnalysis(symbol)` — static mock object or null | None |
| `useMarketSummary()` | `mockMarketSummary` — static array | None |

**Comment on lines 5–6**: _"These hooks wrap mock data functions. When a real market data API is integrated, only this file needs to change — no pages or components."_

### `src/hooks/use-signals.ts` (81 lines) — MIXED (Supabase + mock enrichment)

```
Line 5:  import { mockPairAnalysis } from "@/data/mockMarketData";
```

| Function | Mock usage | Real usage |
|----------|-----------|------------|
| `useSignals()` | Line 34: `analysis: mockPairAnalysis[s.pair] ?? null` — attaches mock PairAnalysis to each signal | Lines 20–25: `supabase.from("signals").select("*")` |
| `useActiveSignals(limit)` | None | Lines 47–54: Supabase query |
| `useSignalsByPair(pair)` | None | Lines 63–72: Supabase query |
| `getQualityForSignal(pair)` | Line 79: `mockPairAnalysis[pair]?.setupQuality ?? null` | None |

---

## 3. Mock Consumers — Components

### `src/components/calculator/RiskCalculator.tsx` (345 lines)

```
Line 10:  import { mockMarketData } from "@/data/mockMarketData";
Line 17:  const PAIRS = Object.keys(mockMarketData);
```

| Item | Line(s) | What's hardcoded | Impact |
|------|---------|-----------------|--------|
| Pair list | 17 | `PAIRS = Object.keys(mockMarketData)` — 14 pairs from mock | Pair dropdown is tied to mock data, not `instruments` table |
| Pip value | 44–47 | `pipValueForPair(_pair)` always returns `10` | Position sizing is incorrect for JPY, CHF, and cross pairs |

**Real calculations** (correctly implemented):
- `pipMultiplier(pair)` — 100 for JPY, 10000 for others (line 22–24)
- `calculateRiskAmount(balance, riskPct, fixedAmount)` (line 26–29)
- `calculatePipDistance(entry, sl, pair)` (line 31–33)
- `calculateLotSize(riskAmount, pipDistance, pipVal)` (line 35–38)
- `calculateExposure(lotSize)` — lotSize * 100,000 (line 40–42)

### `src/components/signals/SignalDetailDrawer.tsx`

Receives `analysis` from enriched signal (which is `mockPairAnalysis[pair]`). Displays:
- Setup type, quality grade, confidence
- Entry zone, SL, TP levels
- Beginner/expert explanations
- Reasons for/against, invalidation conditions

### `src/components/signals/SignalCard.tsx`

Receives enriched signal data. Uses `analysis?.setupQuality` for quality badge display.

---

## 4. Mock Consumers — Pages

### `src/pages/SignalDetail.tsx` (115 lines)

```
Line 3:  import { mockSignals } from "@/data/mockSignals";
Line 8:  const signal = mockSignals.find((s) => s.id === id);
```

| Item | Line(s) | What's hardcoded | Impact |
|------|---------|-----------------|--------|
| Signal lookup | 8 | Finds signal by ID from `mockSignals` array, NOT from Supabase | Signal detail page shows mock data, not DB signals. Route `/signals/:id` is broken for real DB signals because IDs won't match. |

This page bypasses the Supabase-backed `useSignals()` hook entirely. It uses the local mock `Signal` type from `mockSignals.ts` (not the DB-backed type from `types/trading.ts`).

### `src/pages/Index.tsx` (Dashboard, 332 lines)

```
Line 10:  import { useMarketSummary } from "@/hooks/use-market-data";
```

| Item | Line(s) | What's hardcoded | Impact |
|------|---------|-----------------|--------|
| Market summary | 42 | `useMarketSummary()` returns mock data | Market Watch section shows frozen prices |
| Risk used | 51 | `const riskUsed = 0` | "Risk Used Today" always shows 0% |
| Default balance | 47 | `balance = Number(account?.balance ?? 10000)` | Fallback only — acceptable |
| Default equity | 48 | `equity = Number(account?.equity ?? 10000)` | Fallback only — acceptable |

### `src/pages/Watchlist.tsx`

```
import { getMarketData } from "@/data/mockMarketData";  (or via hook)
```

Uses `getMarketData(instrument.symbol)` for each instrument to display price, spread, trends, volatility, S/R levels. All values are frozen mock data.

### `src/pages/PairDetail.tsx`

Uses `usePairAnalysis(pair)` and `useMarketData(pair)` — both return mock data. The entire pair analysis page (setup type, entry zone, confidence, explanations, key levels) is driven by mock.

### `src/pages/Signals.tsx`

Uses `useSignals()` which returns enriched signals. The `analysis` field on each signal comes from `mockPairAnalysis`. Quality filter uses `getQualityForSignal()` which reads mock data.

### `src/pages/Learn.tsx`

Lines 11–19: Hardcoded `sections` array with educational content titles and descriptions. No backend connection. Low priority.

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    MOCK DATA PATH                        │
│                  (no backend calls)                       │
│                                                          │
│  mockMarketData.ts ──→ getMarketData()                   │
│         │              getPairAnalysis()                  │
│         │                    │                            │
│         ▼                    ▼                            │
│  use-market-data.ts    use-signals.ts (enrichment)       │
│         │                    │                            │
│         ▼                    ▼                            │
│  Index.tsx (market)    Signals.tsx (quality filter)       │
│  Watchlist.tsx         SignalDetailDrawer (analysis)      │
│  PairDetail.tsx        SignalCard (quality badge)         │
│                                                          │
│  mockSignals.ts ──→ mockMarketSummary                    │
│         │                    │                            │
│         ▼                    ▼                            │
│  use-market-data.ts    Index.tsx (market watch section)   │
│                                                          │
│  RiskCalculator.tsx ──→ Object.keys(mockMarketData)      │
│         │              pipValueForPair() → always $10     │
└─────────────────────────────────────────────────────────┘

┌────────────────────────���────────────────────────────────┐
│                    REAL DATA PATH                         │
│              (Supabase PostgREST calls)                   │
│                                                          │
│  use-signals.ts ──→ supabase.from("signals")             │
│  use-journal.ts ──→ supabase.from("trade_journal_entries")│
│  use-alerts.ts  ──→ supabase.from("alerts")              │
│  use-watchlist.ts → supabase.from("user_watchlist")      │
│  use-account.ts ──→ supabase.from("trading_accounts")    │
│                     supabase.from("user_risk_profiles")  │
│  use-admin.ts   ──→ supabase.from("signals"/"alerts")   │
│  AuthContext.tsx ──→ supabase.auth.*                      │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Hardcoded Values Summary

| Value | Location | Current | Should be |
|-------|----------|---------|-----------|
| Pip value | `RiskCalculator.tsx:44-47` | `$10` for all pairs | Varies by pair and account currency |
| Risk used today | `Index.tsx:51` | `0` (always) | Computed from open positions |
| Pair dropdown | `RiskCalculator.tsx:17` | `Object.keys(mockMarketData)` | `instruments` table query |
| Default balance | `Index.tsx:47` | `10000` fallback | Acceptable (fallback only) |
| Default equity | `Index.tsx:48` | `10000` fallback | Acceptable (fallback only) |
| Risk threshold | `RiskCalculator.tsx:131` | `5%` max daily | Could be user-configurable (already in `user_risk_profiles.max_daily_loss_pct`) |
| Near-limit threshold | `RiskCalculator.tsx:132` | `3%` warning | Could derive from max_daily_loss_pct |
| Beginner tips | `Index.tsx:16-24` | 7 hardcoded strings | Acceptable for MVP |
| Learn content | `Learn.tsx:11-19` | Hardcoded sections | Placeholder, low priority |

---

## 7. Mock Data — Usage Status

| Export | File | Status |
|--------|------|--------|
| `mockSignals` | mockSignals.ts | **USED** by `SignalDetail.tsx:8` — should query Supabase instead |
| `mockMarketSummary` | mockSignals.ts | **USED** by `use-market-data.ts:17` |
| `watchlistPairs` | mockSignals.ts | UNUSED — watchlist comes from Supabase |
| `mockAlerts` | mockSignals.ts | UNUSED — alerts come from Supabase |
| `mockAccountStats` | mockSignals.ts | UNUSED — account data comes from Supabase |
| `mockNotifications` | mockSignals.ts | UNUSED — not consumed anywhere |
| `mockJournalEntries` | mockSignals.ts | UNUSED — journal comes from Supabase |
| `mockWatchlistData` | mockSignals.ts | UNUSED — not consumed anywhere |

The 6 unused exports are vestiges from before Supabase integration. They can be safely removed. The 2 used exports (`mockSignals`, `mockMarketSummary`) need to be replaced with backend queries.

---

## 8. Integration Seam

The primary replacement point is **`src/hooks/use-market-data.ts`** (19 lines). This file:
1. Is the only hook that returns purely mock data
2. Has a documented comment explaining it's the swap point
3. Is imported by Dashboard, Watchlist, and PairDetail pages
4. Requires no component changes when swapped to real data

Secondary replacement points:
- `src/pages/SignalDetail.tsx:3,8` — replace `mockSignals.find()` with Supabase query
- `src/hooks/use-signals.ts:34` — remove `mockPairAnalysis` enrichment
- `src/hooks/use-signals.ts:79` — `getQualityForSignal()` reads mock
- `src/components/calculator/RiskCalculator.tsx:17,44-47` — pair list and pip value
- `src/types/trading.ts:2,19` — type re-exports from mock file (move to own types)
