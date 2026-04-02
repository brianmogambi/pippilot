

# Phase 8 — Risk Calculator Page Rebuild

## Current state
Basic calculator with 4 inputs (account size, risk %, entry, SL) and 3 outputs (risk amount, SL distance, lot size). Simple component, no validation, no warnings, no educational content beyond a formula box.

## Plan

### 1. Rebuild `src/components/calculator/RiskCalculator.tsx`

**Inputs section** (clean two-column grid):
- Account Balance + Account Equity (side by side)
- Account Currency (Select: USD, EUR, GBP, JPY, AUD, CAD, CHF)
- Selected Pair (Select populated from `mockMarketData` symbols)
- Entry Price + Stop Loss (side by side, auto-populates SL in pips)
- Stop Loss in Pips (editable — syncs bidirectionally with SL price when pair selected)
- Risk % per Trade (slider + input, default 1%, range 0.1–10%)
- Fixed Amount Risk (optional input, overrides % calc when filled)
- Current Open Risk (optional input — existing exposure in $)
- Conservative Mode toggle (Switch — halves the calculated lot size, adds extra warnings)

**Validation**:
- Entry and SL required, must differ
- Risk % clamped 0.1–10
- Account balance must be positive
- SL pips auto-calculated or manually entered
- Visual inline error messages

**Outputs section** (prominent result card):
- Maximum Money at Risk ($)
- Estimated Lot Size (standard lots + mini/micro breakdown)
- Pip Value (derived, placeholder logic — $10/pip for standard lot on USD pairs)
- Estimated Exposure (lot size × 100,000 in account currency)
- Warning badge if total open risk (current + new) exceeds 5% of balance
- Warning badge if daily loss threshold (configurable, default 3%) is near/exceeded

**Conservative mode**: When toggled on, halves lot size, shows "Conservative" badge, adds amber warning about why conservative is recommended for beginners.

### 2. Rebuild `src/pages/CalculatorPage.tsx`

**Layout**: Two-column on desktop (left: calculator form + results; right: educational panels). Stacked on mobile.

**Educational panels** (right column):
- "How Risk is Calculated" — step-by-step explanation with formula
- "Why Smaller Risk Protects Your Account" — brief educational card
- "Impact of Consecutive Losses" — table/visual showing account balance after 1–10 consecutive losses at 1%, 2%, 3% risk (e.g., 10 losses at 2% = ~18% drawdown vs 10 at 5% = ~40%)

### 3. Calculation logic

Extract pure calculation functions into the component (structured for future extraction to a utility file):
- `calculateRiskAmount(balance, riskPct, fixedAmount?)`
- `calculatePipDistance(entry, sl, pipMultiplier)`
- `calculateLotSize(riskAmount, pipDistance, pipValue)`
- `calculateExposure(lotSize)`

Pip multiplier: 10000 for most pairs, 100 for JPY pairs (detected from pair name).

### Files to modify
- `src/components/calculator/RiskCalculator.tsx` — full rebuild
- `src/pages/CalculatorPage.tsx` — full rebuild with educational panels

### No other files change
No DB changes, no route changes.

