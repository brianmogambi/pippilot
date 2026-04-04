# PipPilot AI — Core Gap Analysis

**Date**: 2026-04-04
**Commit**: `b9ccc17` (main)
**Purpose**: Identify what's missing between the current MVP and real backend-driven intelligence, and recommend the smallest safe migration path.

---

## 1. Critical Gaps (Blocking Real Usage)

### Gap 1: No Real Market Data

**Current state**: All market prices, trends, volatility, S/R levels, and session data are frozen values in `src/data/mockMarketData.ts`. Users see the same numbers every time they load the app.

**What's affected**:
- Dashboard Market Watch section (`Index.tsx:42`)
- Watchlist page (`Watchlist.tsx` — calls `getMarketData()`)
- PairDetail page (`PairDetail.tsx` — calls `useMarketData()` + `usePairAnalysis()`)

**What exists**:
- `instruments` table with 15 active forex pairs (has `pip_value` column)
- `use-market-data.ts` designed as the integration seam (19 lines, documented swap point)
- `MarketData` TypeScript interface already defined with all needed fields

**What's needed**:
- A market data API subscription (e.g., Twelve Data, Alpha Vantage, Polygon.io)
- A Supabase Edge Function to fetch and cache prices on a schedule
- A `market_data_cache` table (or similar) for storing latest prices
- Swap `use-market-data.ts` from mock imports to Supabase queries

---

### Gap 2: No Signal Generation Engine

**Current state**: Signals are static rows in the `signals` table, manually inserted. There is no automated analysis. The `SIGNAL_ENGINE_SPEC.md` doc describes the planned approach but nothing is implemented.

**What's affected**:
- Signal explorer (`Signals.tsx`)
- Signal detail views (`SignalDetailDrawer.tsx`)
- PairDetail analysis section (`PairDetail.tsx`)
- Dashboard active signals section (`Index.tsx`)

**What exists**:
- `signals` table with full schema (pair, direction, entry/SL/TP, confidence, verdict, ai_reasoning, status, setup_type)
- `SIGNAL_ENGINE_SPEC.md` with planned algorithm
- Mock `PairAnalysis` objects showing the expected output format (6 pairs)

**What's needed**:
- Supabase Edge Function for deterministic analysis:
  - Multi-timeframe trend alignment (H1, H4, D1)
  - Support/resistance detection
  - Setup pattern matching (flag, breakout, rejection, etc.)
  - Confidence scoring
  - Trade/no-trade verdict
- Scheduled execution (cron or triggered by market data updates)
- Write results to `signals` table

---

### Gap 3: No Real Pip Values

**Current state**: `pipValueForPair()` in `RiskCalculator.tsx:44-47` returns `$10` for every pair regardless of pair type or account currency.

**What's affected**:
- Position size calculator — lot size output is incorrect for:
  - JPY pairs (pip value differs)
  - Cross pairs (no USD in the pair)
  - Non-USD account currencies (need conversion)

**What exists**:
- `instruments` table has a `pip_value` column (currently nullable)
- Risk calculation math is correct — only the pip value input is wrong
- Account currency is stored in `trading_accounts.account_currency`

**What's needed**:
- Populate `instruments.pip_value` with correct standard-lot pip values
- Add exchange rate lookup for non-USD account currencies
- Replace hardcoded function with: `instruments.pip_value` * currency conversion factor
- Also replace `PAIRS = Object.keys(mockMarketData)` with query to `instruments` table

---

### Gap 4: No Daily Risk Tracking

**Current state**: `riskUsed` in `Index.tsx:51` is hardcoded to `0`. The dashboard always shows "Risk Used Today: 0%".

**What's affected**:
- Dashboard "Risk Used Today" stat card
- Dashboard "Risk Remaining" stat card
- Risk warnings that should fire when approaching daily limit

**What exists**:
- `user_risk_profiles.max_daily_loss_pct` stores the user's max daily risk
- `trade_journal_entries` has `lot_size`, `entry_price`, `stop_loss` for open trades
- Risk calculation formulas already implemented in `RiskCalculator.tsx`

**What's needed**:
- Query open journal entries (status = "open") for today
- Compute risk per trade: `lot_size * pip_distance * pip_value / balance`
- Sum to get `riskUsed`
- Could be a derived query or a Supabase function

---

### Gap 5: No Pair Analysis Engine

**Current state**: `PairAnalysis` objects exist for only 6 of 14 instruments in `mockPairAnalysis`. The remaining 8 pairs return `null`, meaning PairDetail pages show no analysis for them.

**What's affected**:
- PairDetail page for 8 pairs: AUD/USD, NZD/USD, USD/CAD, EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD
- Signal enrichment — `EnrichedSignal.analysis` is null for unmocked pairs
- Quality filter in signal explorer

**What's needed**:
- Part of Gap 2 (signal generation engine). Once deterministic analysis runs for all pairs, this gap is automatically closed.

---

## 2. Non-Critical Gaps (Not Blocking)

| Gap | Current | Planned phase | Priority |
|-----|---------|--------------|----------|
| No real-time updates | Prices only refresh on page load | Phase 2 | Medium |
| No notification delivery | Alerts exist in DB but no email/push/Telegram | Phase 3 | Medium |
| No broker integration | No position import or trade tracking | Phase 4 | Low |
| Minimal test coverage | 1 example test, no meaningful coverage | Ongoing | Medium |
| Learn page placeholder | Hardcoded content sections | Low priority | Low |
| TypeScript strict mode off | `strict: false` in tsconfig | Ongoing | Low |
| No CI/CD pipeline | No automated build/test/deploy | Ongoing | Medium |
| Dead mock exports | 7 exports in mockSignals.ts are never imported | Cleanup | Low |

---

## 3. Recommended Migration Path

### Principle

Replace mock data **layer by layer** through the existing `use-market-data.ts` abstraction. Each step is independently deployable. Each preserves current UI behavior. No redesigns.

### Constraints (from user)
- Preserve current UI behavior
- No redesigns unless required
- No auto-trading
- Keep deterministic logic separate from AI explanation logic

---

### Step 1: Real Market Data Feed

**Scope**: Highest impact, lowest risk. Replaces frozen prices with live data.

**Implementation**:
1. Choose market data API (Twelve Data free tier provides 8 calls/min, 800/day — sufficient for 15 pairs updated every few minutes)
2. Create `market_data_cache` table:
   ```sql
   create table market_data_cache (
     symbol text primary key references instruments(symbol),
     price numeric not null,
     spread numeric,
     daily_change numeric,
     daily_change_pct numeric,
     high numeric,
     low numeric,
     prev_close numeric,
     updated_at timestamptz default now()
   );
   ```
3. Create Supabase Edge Function `fetch-market-data`:
   - Fetches latest prices from API
   - Upserts into `market_data_cache`
   - Triggered by pg_cron (every 5 minutes during market hours)
4. Update `use-market-data.ts`:
   - Replace `getMarketData()` with `supabase.from("market_data_cache").select("*").eq("symbol", symbol)`
   - Use TanStack React Query with 60-second stale time

**Change surface**: 1 new table, 1 new Edge Function, 1 hook file modified
**UI impact**: Market Watch, Dashboard, Watchlist show live prices
**Risk**: Low — if API fails, show last cached values

---

### Step 2: Real Pip Values

**Scope**: Fixes position sizing accuracy. Can run in parallel with Step 1.

**Implementation**:
1. Populate `instruments.pip_value` for all 15 pairs:
   ```sql
   update instruments set pip_value = 10 where symbol like '%/USD' and symbol not like 'USD/%';
   update instruments set pip_value = 0.01 where symbol like '%JPY%';
   -- etc. for each pair type
   ```
2. In `RiskCalculator.tsx`:
   - Replace `const PAIRS = Object.keys(mockMarketData)` with hook: `useInstruments()` from `use-watchlist.ts` (already exists)
   - Replace `pipValueForPair()` with lookup from `instruments.pip_value`
   - Add currency conversion factor using `market_data_cache` prices (from Step 1)
3. Remove `import { mockMarketData } from "@/data/mockMarketData"` from RiskCalculator

**Change surface**: 1 migration (pip_value data), RiskCalculator.tsx modifications
**UI impact**: Position sizing becomes accurate
**Risk**: Low — mathematical change, easily testable

---

### Step 3: Deterministic Signal Generation

**Scope**: Replaces static signal rows with automated analysis. Depends on Step 1 (needs real price data).

**Implementation**:
1. Create Supabase Edge Function `generate-signals`:
   - Input: `market_data_cache` rows + historical OHLCV (from market API)
   - Logic (deterministic, no AI):
     - Multi-timeframe trend detection (H1, H4, D1 using EMA/SMA crossovers)
     - Support/resistance level identification
     - Setup pattern matching (flag, breakout, rejection, range)
     - Confidence scoring (weighted by trend alignment, pattern clarity, volatility)
     - Trade/no-trade verdict (thresholds from `SIGNAL_ENGINE_SPEC.md`)
   - Output: Insert/update rows in `signals` table
2. Store analysis metadata in a new `pair_analyses` table (replacing `mockPairAnalysis`):
   ```sql
   create table pair_analyses (
     id uuid primary key default gen_random_uuid(),
     pair text not null,
     setup_type text,
     direction text,
     entry_zone_low numeric,
     entry_zone_high numeric,
     stop_loss numeric,
     tp1 numeric, tp2 numeric, tp3 numeric,
     confidence integer,
     setup_quality text,
     invalidation text,
     reasons_for text[],
     reasons_against text[],
     no_trade_reason text,
     verdict text,
     created_at timestamptz default now()
   );
   ```
3. Update `use-signals.ts`: Replace `mockPairAnalysis` enrichment with query to `pair_analyses`
4. Update `use-market-data.ts`: Replace `usePairAnalysis()` with query to `pair_analyses`
5. Scheduled via pg_cron (run after market data refresh)

**Change surface**: 1 new table, 1 Edge Function, 2 hooks modified
**UI impact**: Signals and PairDetail show real, generated analysis for all 15 pairs
**Constraint**: All scoring is deterministic — no AI in this step

---

### Step 4: AI Explanation Layer

**Scope**: Adds human-readable reasoning to signals. Depends on Step 3 (needs signal data to explain). **Separate from deterministic logic.**

**Implementation**:
1. After signal generation in Edge Function:
   - Pass signal data (pair, direction, setup type, confidence, reasons) to Claude/GPT API
   - Generate: `ai_reasoning`, `beginnerExplanation`, `expertExplanation`
   - Store in `signals.ai_reasoning` and `pair_analyses` explanation columns
2. Add columns to `pair_analyses`:
   ```sql
   alter table pair_analyses add column beginner_explanation text;
   alter table pair_analyses add column expert_explanation text;
   ```
3. AI call is post-processing only — never modifies scores, confidence, or verdict

**Change surface**: API call added to Edge Function, 2 columns added
**UI impact**: Signal cards and detail views show AI-generated reasoning
**Constraint**: AI explains; it does not decide. Deterministic engine owns all numerical outputs.

---

### Step 5: Daily Risk Tracking

**Scope**: Fixes the hardcoded `riskUsed = 0`. Independent of other steps.

**Implementation**:
1. Create a query or Supabase function:
   ```sql
   create function get_daily_risk_used(p_user_id uuid)
   returns numeric as $$
     select coalesce(sum(
       abs(lot_size * (entry_price - stop_loss)) * 100000 /
       (select balance from trading_accounts where user_id = p_user_id and is_default = true)
     ) * 100, 0)
     from trade_journal_entries
     where user_id = p_user_id
       and status = 'open'
       and created_at >= current_date;
   $$ language sql security definer;
   ```
2. Create hook `useDailyRiskUsed()` calling `.rpc("get_daily_risk_used")`
3. Replace `const riskUsed = 0` in `Index.tsx` with hook result

**Change surface**: 1 DB function, 1 hook, 1 line in Index.tsx
**UI impact**: Dashboard shows real daily risk percentage

---

## 4. Dependency Graph

```
Step 1: Real Market Data ──────────┐
                                    ├──→ Step 3: Signal Generation ──→ Step 4: AI Explanations
Step 2: Real Pip Values ───────────┘
                                         (parallel)
Step 5: Daily Risk Tracking ─────────── (independent)
```

- Steps 1 & 2: Can run in parallel
- Step 3: Requires Step 1 (needs real prices)
- Step 4: Requires Step 3 (needs signal data)
- Step 5: Independent, can run anytime

---

## 5. What Can Be Safely Deleted After Migration

Once all 5 steps are complete:

| File/Export | Condition for deletion |
|------------|----------------------|
| `src/data/mockMarketData.ts` | After Steps 1 + 3 (all consumers replaced) |
| `src/data/mockSignals.ts` | After Steps 1 + 3 (mockMarketSummary replaced, dead exports already unused) |
| Mock type exports in `src/types/trading.ts:18-19` | After types come from `pair_analyses` table |
| `mockPairAnalysis` import in `use-signals.ts` | After Step 3 |
| `mockMarketData` import in `RiskCalculator.tsx` | After Step 2 |

---

## 6. Risk Assessment

| Step | Risk level | Rollback strategy |
|------|-----------|-------------------|
| 1. Market data | Low | Fall back to cached data; show "last updated" timestamp |
| 2. Pip values | Low | Revert migration; previous hardcoded value was wrong anyway |
| 3. Signal generation | Medium | Disable Edge Function; signals table retains last generated data |
| 4. AI explanations | Low | Show "Analysis generating..." placeholder; deterministic data still present |
| 5. Risk tracking | Low | Revert to `riskUsed = 0`; cosmetic only |

---

## 7. What NOT To Do

Per constraints:
- **No auto-trading**: All outputs are decision support only
- **No UI redesigns**: Use existing components, just swap data source
- **No broad refactors**: Change only the files listed in each step
- **AI never overrides deterministic logic**: Scores, confidence, and verdicts are owned by the deterministic engine
- **No premature optimization**: Get real data flowing first, optimize later
