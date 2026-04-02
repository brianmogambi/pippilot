

# Phase 6 — Pair Detail / Chart Analysis Page

## Current state
`PairDetail.tsx` is a basic overview: price/spread/change cards, 3 trend cards, session/news badges, active signals list, journal entries list, and a "chart coming soon" placeholder. It already queries `signals`, `user_watchlist`, and `trade_journal_entries` from DB and uses `mockMarketData` for prices/trends.

## What changes
Full rebuild of `src/pages/PairDetail.tsx` into a professional analysis workspace with 7 sections. Also extend `mockMarketData.ts` with key levels data and create a mock setup/analysis data structure.

---

### 1. Extend mock data (`src/data/mockMarketData.ts`)
Add to `MarketData` interface and each entry:
- `supportLevel`, `resistanceLevel`, `sessionHigh`, `sessionLow`, `prevDayHigh`, `prevDayLow` (numeric placeholders)
- `marketStructure`: "trending" | "ranging" | "breakout"

Create a new exported `mockPairAnalysis` map keyed by symbol with:
- `setupType`, `direction`, `entryZone` [min, max], `stopLoss`, `tp1`, `tp2`, `tp3`, `confidence`, `setupQuality` ("A+" | "A" | "B" | "C"), `invalidation` (text)
- `beginnerExplanation`, `expertExplanation`, `reasonsFor` (string[]), `reasonsAgainst` (string[]), `noTradeReason` (string | null)
- `verdict`: "trade" | "no_trade"
- Only provide analysis for ~6 pairs; others return null (no setup available state)

### 2. Rebuild `src/pages/PairDetail.tsx`

**Layout**: Two-column on desktop (left: chart + key levels + setup; right: bias summary + AI explanation + alerts). Full stack on mobile.

**Section 1 — Header**
- Back button, pair name, price (mono), spread, daily change (colored), session badge, favorite toggle
- Compact single row

**Section 2 — Chart Area**
- Large card with aspect-video ratio placeholder
- Timeframe selector bar: 5m, 15m, 1H, 4H, 1D (toggle group, visual only for now)
- "TradingView integration coming soon" message

**Section 3 — Multi-Timeframe Bias Summary** (right column top)
- 4 compact cards in a 2x2 grid:
  - Higher TF Trend (D1 trend from market data)
  - Execution TF (H1 trend)
  - Volatility Condition (volatility level + ATR)
  - Market Structure (new field)
- Each with icon, label, StatusBadge

**Section 4 — Key Levels Panel** (below chart, left column)
- Card with 6 rows: Support, Resistance, Session High, Session Low, Prev Day High, Prev Day Low
- Mono font values, colored labels

**Section 5 — Setup Card**
- If analysis exists and verdict is "trade": direction badge, setup type, entry zone range, SL, TP1/TP2/TP3, confidence bar, setup quality badge, invalidation text
- If verdict is "no_trade": prominent "No Trade Recommended" state with Ban icon and reason
- If no analysis: empty state "No setup analysis available"

**Section 6 — AI Explanation Panel** (right column)
- Tabbed or sectioned: Beginner / Expert explanations
- Reasons For (green bullets) and Reasons Against (red bullets)
- No-trade explanation if applicable

**Section 7 — Alert Controls** (bottom of right column)
- Card with 3 toggle switches:
  - "Notify on entry zone reached"
  - "Notify on confirmation"
  - "Notify on TP/SL/invalidation"
- Toggles are visual only for now (toast on toggle, no DB write yet)

**Existing features retained**: Active signals list (from DB), recent journal entries (from DB), disclaimer footer.

### Files to modify
- `src/data/mockMarketData.ts` — extend interface + add `mockPairAnalysis`
- `src/pages/PairDetail.tsx` — full rebuild

### No other files change
Routes, layout, other pages untouched. No DB changes needed.

