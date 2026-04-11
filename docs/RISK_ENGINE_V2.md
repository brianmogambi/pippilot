# Phase 6 — Risk Engine v2

Single source of truth for position-sizing and risk-evaluation rules,
extracted from the Risk Calculator React component into a backend-safe
pure module.

---

## Why v2

`docs/RISK_ENGINE_SPEC.md` (v1) described the formulas the calculator
*should* honour, but the formulas were actually implemented inline in
two places:

- `src/components/calculator/RiskCalculator.tsx` — pure helpers and
  inline aggregate logic for total-risk %, threshold checks, and
  conservative-mode halving (lines 13–54 and 109–120 in the v1 file).
- `src/hooks/use-daily-risk.ts` — a duplicate of the
  `pipDistance × lot × pipValue` formula (lines 40–47 in the v1 file).

This made it impossible for any non-React caller (e.g. an Edge Function
gating signal generation on risk) to reuse the rules, and it created
two places where the math could drift.

Phase 6 collapses both call sites onto a single module, `src/lib/risk-engine.ts`,
with a stable typed surface so future consumers (signal engine,
backtesting, prop-firm rule checker) can plug in without rewriting any
business logic.

---

## Architecture

```
                ┌──────────────────────┐
                │  src/lib/risk-engine │  ◄── pure, synchronous, no React,
                │       (this PR)      │       no Supabase, no DOM/Node-only
                └─────────┬────────────┘       globals.
                          │  imports only ./pip-value (also pure)
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
RiskCalculator.tsx   use-daily-risk.ts   (future) signal-engine
 evaluateTrade()     calculateOpenRiskUSD evaluateTrade() / evaluatePropFirmRules
```

Constraints:

- The engine **never** owns I/O. Pip values are an *input*, not a
  derivation — the React side already has `usePipValue` for live + fallback.
- Engine **owns its own types** (no `Tables<>` cross-imports) so a future
  copy in `supabase/functions/_shared/risk-engine.ts` is a single-file move.
- Warnings are **data**, not React components: `RiskWarning[]` round-trips
  cleanly to JSON for any future Edge Function that wants to persist them
  on a signal row.

---

## Module API

All exports from `src/lib/risk-engine.ts`:

### Constants

| Constant | Value | Purpose |
|---|---|---|
| `RISK_THRESHOLDS.MIN_RISK_PCT` | `0.1` | Lower bound for `riskPerTradePct` |
| `RISK_THRESHOLDS.MAX_RISK_PCT` | `10` | Upper bound for `riskPerTradePct` |
| `RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT` | `5` | Hard ceiling — block above this |
| `RISK_THRESHOLDS.DAILY_LOSS_GUIDELINE_PCT` | `3` | Soft warning above this |
| `RISK_THRESHOLDS.CONSERVATIVE_LOT_MULTIPLIER` | `0.5` | Halves lot size |
| `RISK_THRESHOLDS.STANDARD_LOT_UNITS` | `100_000` | 1 standard lot |

### Types

| Type | What it carries |
|---|---|
| `RiskMode` | `"percent" \| "fixed"` |
| `AccountState` | `balance, equity, currency` |
| `RiskProfile` | `riskPerTradePct, maxDailyLossPct, maxTotalOpenRiskPct, conservativeMode` |
| `TradeInputs` | `pair, entry, stopLoss, pipValueUSD, riskMode, fixedRiskAmount?` |
| `OpenPosition` | `pair, lotSize, entry, stopLoss, pipValueUSD` |
| `DailyState` | `realizedLossUSD, openRiskUSD` |
| `RiskWarningCode` | discriminated union of all warning codes |
| `RiskWarning` | `level: "info" \| "warn" \| "block"` + `code` + `message` |
| `RiskValidationErrors` | per-field error map |
| `RiskEvaluation` | full output of `evaluateTrade()` — sizing, aggregate, decision |

### Pure functions

| Function | Behaviour |
|---|---|
| `calculateRiskAmount(account, profile, mode, fixed?)` | Fixed when mode === "fixed" and value > 0; else `balance × pct/100` |
| `calculatePipDistance(pair, entry, stopLoss)` | `\|entry - stopLoss\| × pipMultiplier(pair)` |
| `calculateLotSize(riskUSD, pipDistance, pipValueUSD)` | `riskUSD / (pipDistance × pipValueUSD)`; returns `0` if denominator term ≤ 0 |
| `applyConservativeMode(rawLot, on)` | Halves when on |
| `calculateExposureUnits(lotSize)` | `lotSize × 100_000` |
| `calculateMoneyAtRiskUSD(lot, pipDist, pipValue)` | The formula `use-daily-risk` used to inline |
| `calculateOpenRiskUSD(positions)` | Sums money-at-risk across an array, ignoring degenerate rows |
| `validateTradeInputs(account, trade, profile)` | Returns `RiskValidationErrors` (empty object on clean inputs) |

### Single entry point

```ts
evaluateTrade({ account, profile, trade, daily, correlated?, propFirm? })
  → RiskEvaluation
```

Composes all the pure functions and applies all warning rules. Pure:
identical inputs ⇒ identical output. Used by the calculator UI today
and intended for the deterministic signal engine in a future phase.

Warning rules (preserved verbatim from v1):

- `totalOpenRiskPctAfterTrade > 5` ⇒ block, `exceeds_safety_threshold`
- `totalOpenRiskPctAfterTrade > 3` (and ≤ 5) ⇒ warn, `exceeds_daily_loss_guideline`
- `totalOpenRiskPctAfterTrade > profile.maxTotalOpenRiskPct` ⇒ block, `exceeds_total_open_risk_profile`
- `dailyLossPct > profile.maxDailyLossPct` ⇒ block, `exceeds_daily_loss_profile`
- `profile.conservativeMode === true` ⇒ info, `conservative_mode_active`
- Any non-empty `validationErrors` ⇒ block per error, `validation_error`
- `blocked = warnings.some(w => w.level === "block")`

### Placeholders (no-op v2 implementations)

| Export | Purpose |
|---|---|
| `CorrelatedExposureCheck` interface | Pluggable check that emits `RiskWarning \| null` |
| `noopCorrelatedExposureCheck` | Always returns `null` — default for `evaluateTrade` |
| `PropFirmRules` interface | Daily/total loss caps + optional max lot/min trading days |
| `PropFirmCheckResult` | `{ passed, warnings }` |
| `evaluatePropFirmRules(rules, state)` | No-op when `rules == null`; future phase fills in the body |

`evaluateTrade` accepts both as optional arguments and defaults to the
no-ops, so call sites compile against the real shapes today and a
future phase fills in the bodies without touching them.

---

## Numerical parity

Canonical scenarios from `docs/RISK_ENGINE_SPEC.md`. The engine output
must match v1 exactly.

| Scenario | Inputs | `riskAmountUSD` | `lotSize` | `exposureUnits` |
|---|---|---|---|---|
| Standard | $10,000 / 1% / EUR/USD / 50-pip SL / pipVal $10 | 100 | 0.20 | 20,000 |
| Conservative | same + conservative ON | 100 | 0.10 | 10,000 |
| JPY | $10,000 / 1% / USD/JPY / 50-pip SL / pipVal ≈ $6.46 | 100 | ≈ 0.31 | ≈ 30,950 |
| Total > 5% | $10,000 / 1% / +$500 open risk | 100 | 0.20 | 20,000 (blocked) |

Asserted by `src/lib/__tests__/risk-engine.test.ts` (33 tests, all
passing).

---

## Integration points

| Caller | What it consumes | What it stopped doing |
|---|---|---|
| `src/components/calculator/RiskCalculator.tsx` | `evaluateTrade()`, `calculatePipDistance()` (for SL ↔ pips sync), `RiskWarning` type | Owns no math; no inline `calculateRiskAmount`/`calculateLotSize`/`validate`; warning JSX is now `bannerWarnings.map(...)` |
| `src/hooks/use-daily-risk.ts` | `calculateOpenRiskUSD()`, `OpenPosition` type | Stopped inlining `pipDistance × lot × pipValue`. Hook signature, return type, query key, and React Query semantics unchanged. |
| **Future**: deterministic signal engine | `evaluateTrade()`, `evaluatePropFirmRules()` | Should call into the engine before persisting a `signals` row, attach `RiskEvaluation.warnings` to the row, and refuse to persist when `blocked === true`. |

---

## Extension points

### Correlated exposure

```ts
interface CorrelatedExposureCheck {
  evaluate(positions: readonly OpenPosition[], newTrade: TradeInputs): RiskWarning | null;
}
```

A future phase will ship a real implementation backed by a pair
correlation table (e.g. `EUR/USD ↔ EUR/GBP`). The wiring already
exists: `evaluateTrade` calls `correlated.evaluate(...)` and appends
the result to `warnings` if non-null. No call-site changes needed when
the body lands.

### Prop-firm rules

```ts
interface PropFirmRules { maxDailyLossUSD; maxTotalLossUSD; maxLotSize?; minTradingDays?; }
function evaluatePropFirmRules(rules, state) → { passed, warnings };
```

Same wiring story: `evaluateTrade` calls `evaluatePropFirmRules(propFirm, …)`
and merges its warnings. The future implementation will likely persist
`PropFirmRules` per `trading_accounts` row.

---

## Test plan

```bash
npx vitest run src/lib/__tests__/risk-engine.test.ts
```

33 tests covering:

1. `calculateRiskAmount` — percent / fixed override / fallback when fixed=0
2. `calculatePipDistance` — non-JPY, JPY, identical entry/SL → 0
3. `calculateLotSize` — normal + zero/negative denominator
4. `applyConservativeMode` — off/on
5. `calculateExposureUnits`
6. `calculateMoneyAtRiskUSD` + `calculateOpenRiskUSD` — sum + ignore degenerate
7. `validateTradeInputs` — every error branch + clean case
8. `evaluateTrade` end-to-end — happy path, conservative, > 5% block,
   3–5% warn, profile cap, daily loss cap, validation block, parity scenario
9. Constants exported (`RISK_THRESHOLDS.*`)
10. Placeholders (`noopCorrelatedExposureCheck`, `evaluatePropFirmRules(null, …)`)

Plus repo-wide checks:

```bash
npx tsc --noEmit
npx vite build
```

---

## TODOs for future phases

- **Mirror to `supabase/functions/_shared/risk-engine.ts`** when an
  Edge Function needs to gate signals on risk. The module is already
  backend-safe — copy the file verbatim, swap the `./pip-value` import
  for a Deno-friendly path, done.
- **Persist correlated-exposure groups** in a config table and ship a
  real `CorrelatedExposureCheck` implementation.
- **Persist prop-firm rules per `trading_accounts` row** and ship a
  real `evaluatePropFirmRules` body.
- **Wire `RiskEvaluation.warnings` onto persisted signals** so the UI
  can render the same engine warnings on the signal card without
  recomputing them.
