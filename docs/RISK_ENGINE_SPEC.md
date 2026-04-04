# PipPilot AI — Risk Engine Specification

---

## Overview

The risk engine calculates position sizes, enforces daily drawdown limits, and monitors cumulative exposure. Currently implemented as a client-side calculator (`RiskCalculator.tsx`). Intended to evolve into a server-side engine that enforces rules before any signal recommendation.

---

## Core Formula

### Position Sizing
```
Risk Amount ($) = Account Balance × (Risk % / 100)
                  OR Fixed Risk Amount (if specified)

Pip Distance   = |Entry Price - Stop Loss| × Pip Multiplier

Pip Multiplier = 100     (for JPY pairs)
                 10,000  (for all other pairs)

Lot Size       = Risk Amount / (Pip Distance × Pip Value per Lot)

If Conservative Mode ON:
  Lot Size = Lot Size / 2
```

### Lot Size Conversions
```
Standard Lots = Lot Size
Mini Lots     = Lot Size × 10
Micro Lots    = Lot Size × 100
Units         = Lot Size × 100,000
```

### Exposure Calculation
```
Notional Exposure = Lot Size × 100,000 (in base currency)
```

---

## Pip Value Concept

A **pip** (Percentage in Point) is the smallest standard price increment in forex:
- For most pairs: 0.0001 (4th decimal place)
- For JPY pairs: 0.01 (2nd decimal place)

**Pip Value** = the dollar amount gained or lost per pip movement per standard lot.

| Pair Type | Pip Value (per standard lot) |
|-----------|----------------------------|
| USD-quoted (EUR/USD, GBP/USD) | $10.00 / pip |
| USD-base (USD/JPY, USD/CHF) | Varies by exchange rate |
| Cross pairs (EUR/GBP, AUD/JPY) | Requires conversion through USD |

### Current Implementation (V1 — Simplified)
```typescript
function pipValueForPair(_pair: string) {
  return 10; // Placeholder — $10 per pip per standard lot
}
```

### Future Implementation (Accurate)
```
For USD-quoted pairs:
  pip_value = 0.0001 × lot_size_units = $10 per standard lot

For USD-base pairs (e.g., USD/JPY at 154.82):
  pip_value = (0.01 / 154.82) × 100,000 = $6.46 per standard lot

For cross pairs (e.g., EUR/GBP):
  pip_value_in_GBP = 0.0001 × 100,000 = £10
  pip_value_in_USD = £10 × GBP/USD rate
```

---

## Inputs

| Input | Source | Type | Default |
|-------|--------|------|---------|
| Account Balance | `trading_accounts.balance` or manual | number | 10,000 |
| Account Equity | `trading_accounts.equity` or manual | number | 10,000 |
| Account Currency | `trading_accounts.account_currency` | string | "USD" |
| Pair | User selection | string | "EUR/USD" |
| Entry Price | Signal or manual | number | required |
| Stop Loss | Signal or manual | number | required |
| Risk % per Trade | `user_risk_profiles.risk_per_trade_pct` or slider | number | 1.0 |
| Fixed Risk Amount | Manual override | number | optional |
| Current Open Risk | Manual input | number | optional |
| Conservative Mode | `user_risk_profiles.conservative_mode` | boolean | false |
| Max Daily Loss % | `user_risk_profiles.max_daily_loss_pct` | number | 5 |
| Max Total Open Risk % | `user_risk_profiles.max_total_open_risk_pct` | number | 10 |

---

## Exposure Checks

### Daily Drawdown Protection
```
Daily Risk Used (%) = (Total losses today + open risk) / Account Balance × 100

IF Daily Risk Used >= Max Daily Loss %:
  → Block new trades
  → Show red warning: "Daily loss limit reached"
```

### Cumulative Open Risk
```
Total Open Risk ($) = Current Open Risk + New Trade Risk Amount
Total Open Risk (%) = Total Open Risk ($) / Account Balance × 100

IF Total Open Risk (%) > 5%:
  → Red warning: "Exceeds 5% safety threshold"

IF Total Open Risk (%) > 3%:
  → Yellow warning: "Approaching 3% daily loss guideline"
```

### Conservative Mode
When enabled:
- Lot size is automatically halved
- This reduces both potential profit AND potential loss
- Recommended for beginners to reduce emotional pressure
- Blue info banner displayed

---

## Validation Rules

| Rule | Condition | Error Message |
|------|-----------|---------------|
| Balance positive | `balance > 0` | "Must be positive" |
| Entry required | `entry > 0` | "Required" |
| SL required | `sl > 0` | "Required" |
| SL ≠ Entry | `entry !== sl` | "Must differ from entry" |
| Risk % range | `0.1 ≤ riskPct ≤ 10` | "0.1% – 10%" |

---

## Example Calculations

### Example 1: Standard Trade
```
Account Balance: $10,000
Risk %: 1%
Pair: EUR/USD
Entry: 1.0872
Stop Loss: 1.0830
Conservative Mode: OFF

Risk Amount = $10,000 × 0.01 = $100
Pip Distance = |1.0872 - 1.0830| × 10,000 = 42 pips
Pip Value = $10 / pip / lot
Lot Size = $100 / (42 × $10) = 0.24 lots
Exposure = 0.24 × 100,000 = $24,000

Result: Trade 0.24 standard lots (2.4 mini, 24 micro)
```

### Example 2: Conservative Mode
```
Same as above with Conservative Mode ON:
Lot Size = 0.24 / 2 = 0.12 lots
Exposure = 0.12 × 100,000 = $12,000

Result: Trade 0.12 standard lots (1.2 mini, 12 micro)
```

### Example 3: JPY Pair
```
Account Balance: $10,000
Risk %: 2%
Pair: USD/JPY
Entry: 154.82
Stop Loss: 154.10

Risk Amount = $10,000 × 0.02 = $200
Pip Distance = |154.82 - 154.10| × 100 = 72 pips
Pip Value = $10 / pip / lot (simplified)
Lot Size = $200 / (72 × $10) = 0.28 lots
```

### Example 4: Exposure Warning
```
Account Balance: $10,000
Current Open Risk: $400 (4% of balance)
New Trade Risk: $200 (2% of balance)
Total Risk = $600 (6% of balance)

→ RED WARNING: "Total open risk would be 6.0% of balance — exceeds the 5% safety threshold."
```

---

## Edge Cases

1. **SL = Entry:** Division by zero in pip distance → lot size = 0. Caught by validation.
2. **Very small pip distance (< 5 pips):** Results in very large lot sizes. Should warn user.
3. **Very large pip distance (> 200 pips):** Results in very small lot sizes. Consider minimum lot size (0.01).
4. **Fixed risk overriding %:** When fixed amount is set, it takes precedence over percentage calculation.
5. **Equity < Balance:** Indicates open losing positions. Consider using equity instead of balance for risk calculations.
6. **Cross-currency accounts:** If account is EUR but trading USD pairs, conversion is needed for accurate risk calculation.

---

## Future Server-Side Implementation

When the risk engine moves server-side:

1. **Pre-trade validation:** Before inserting a signal recommendation, check if the user can afford the risk
2. **Real-time pip values:** Fetch current exchange rates for accurate cross-currency pip value calculations
3. **Open position tracking:** Query broker API for current open positions and unrealized P/L
4. **Auto-sizing:** When a signal is generated, automatically calculate and suggest position size based on user's risk profile
5. **Daily reset:** Track daily P/L and auto-lock trading when daily loss limit is hit
6. **Correlation risk:** Check if multiple signals are on correlated pairs (e.g., EUR/USD and EUR/GBP) and reduce combined exposure
