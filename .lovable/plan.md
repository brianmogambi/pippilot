

# Phase 7 — Signals Page Rebuild

## Current state
- `Signals.tsx`: Basic page using `mockSignals` from `mockSignals.ts`, simple card grid, only timeframe + verdict filters
- `SignalDetail.tsx`: Basic two-column layout with price levels, AI reasoning, and risk calculator — uses `mockSignals` data
- `SignalCard.tsx`: Simple card with pair, direction, entry/SL/TP1, confidence bar
- DB `signals` table already has: pair, direction, timeframe, setup_type, entry_price, stop_loss, tp1/tp2/tp3, confidence, verdict, status, ai_reasoning, invalidation_reason, created_at
- `mockPairAnalysis` in `mockMarketData.ts` already has setup quality, beginner/expert explanations, reasons for/against, no-trade reasoning

## What changes

### 1. Signals page rebuild (`src/pages/Signals.tsx`)

**Header**: Title, subtitle, disclaimer warning badge ("AI-generated — not financial advice")

**Filter bar** (row of Select dropdowns + search):
- Pair search/select (text input filters by pair name)
- Timeframe: All / 5m / 15m / 1H / 4H / D
- Direction: All / Long / Short
- Setup Quality: All / A+ / A / B / C
- Confidence range: All / 80%+ / 60-79% / Below 60%
- Status: All / Monitoring / Ready / Triggered / Invalidated / Closed

**Table view** (replaces card grid — professional trader UX):
- Columns: Pair, Direction (arrow + badge), Timeframe, Setup Type, Entry, SL, TP1, R:R (computed), Confidence (bar + %), Quality badge, Status badge, Timestamp (relative)
- Each row clickable → opens signal detail drawer/sheet
- Responsive: table on desktop, stacked cards on mobile

**Data source**: Query `signals` table from DB. Merge with `mockPairAnalysis` for quality/explanations. Fall back gracefully when no analysis exists.

**States**: Loading skeleton, empty state with message, no-match filter state.

### 2. Signal detail drawer (`src/components/signals/SignalDetailDrawer.tsx`)

Uses `Sheet` component (slide-in from right). Sections:

- **Header**: Pair, direction badge, timeframe, status, quality badge, disclaimer label
- **Price levels**: Entry, SL, TP1/TP2/TP3, R:R ratio
- **Setup info**: Setup type, confidence bar, aggressive vs conservative label (derived: confidence >= 75 = aggressive, else conservative)
- **AI Explanation panel**: Tabbed — Beginner / Expert (from `mockPairAnalysis`)
- **Reasons For** (green) / **Reasons Against** (red) bullet lists
- **Invalidation condition** (from DB `invalidation_reason` or analysis)
- **Management plan** (hardcoded placeholder: "Scale out at TP1, move SL to breakeven, trail to TP2/TP3")
- **No-trade explanation** if verdict is no_trade (prominent warning card)
- **Warning footer**: "This is AI-generated analysis. Always do your own research."

### 3. Update SignalCard for mobile fallback (`src/components/signals/SignalCard.tsx`)
- Add setup_type, quality badge, status badge, R:R ratio, timestamp
- Keep as mobile-responsive card version of the table data

### Files to create
- `src/components/signals/SignalDetailDrawer.tsx`

### Files to modify
- `src/pages/Signals.tsx` — full rebuild with filters + table + DB query
- `src/components/signals/SignalCard.tsx` — enhanced with additional fields

### No database or route changes needed
All fields already exist in the `signals` table. Routes already configured.

