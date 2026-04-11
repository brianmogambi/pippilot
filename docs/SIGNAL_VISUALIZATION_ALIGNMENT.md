# Phase 5 — Signal Visualization Alignment

This phase wires the deterministic signal engine to every UI surface that
displays a setup, so the chart, the Setup Analysis card, the Active
Signals list, the Signal Explorer table, and the new context strip all
read from the same persisted record. It also removes a frontend-only
risk/reward derivation that was duplicating engine logic.

---

## The single source of truth

```
                       ┌─────────────────────┐
                       │  signal-engine.ts   │
                       │ (Edge Function)     │
                       └─────────┬───────────┘
                                 │ analyzeForSignal()
                                 ▼
                ┌────────────────────────────────┐
                │  generate-signals (Edge Fn)    │
                │  insert ↓        insert ↓      │
                │  signals          pair_analyses│
                │  (PK id)  ◄── signal_id (FK)   │
                │  + risk_reward    + risk_reward│
                └────────────────────────────────┘
                                 │
                                 ▼
                ┌────────────────────────────────┐
                │  useSignalsByPair(pair)        │
                │  PostgREST FK join:            │
                │  signals + pair_analyses!      │
                │    pair_analyses_signal_id_fkey│
                │  → EnrichedSignal[]            │
                └────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       SetupContextBar    CandlestickChart     Active Signals
       (header strip)     (overlays + label)   (list rows)
                                 │
                                 ▼
                          Setup Analysis card
```

Each `EnrichedSignal` is a `signals` row plus the **specific**
`pair_analyses` row that the engine wrote alongside it (via the
`signal_id` FK). PairDetail derives the active signal as
`enrichedSignals[0]` and feeds the same object to every UI surface.

---

## What changed

### Backend

| File | Change |
|---|---|
| `supabase/migrations/20260411100000_add_risk_reward.sql` | New columns `signals.risk_reward` and `pair_analyses.risk_reward` (numeric, nullable). |
| `supabase/functions/_shared/signal-engine.ts` | `SignalOutput` now carries `riskReward`. Already computed at line 534, now returned. |
| `supabase/functions/generate-signals/index.ts` | Persists `risk_reward` in both insert mappings. |

### Frontend

| File | Change |
|---|---|
| `src/hooks/use-signals.ts` | `useSignalsByPair` now joins `pair_analyses!pair_analyses_signal_id_fkey(*)` and returns `EnrichedSignal[]`. RR sourced from the persisted column when present, else computed via `computeRR` fallback. |
| `src/components/chart/SetupContextBar.tsx` | New pure-presentation strip. Renders setup type, direction, verdict, confidence, quality, market structure, D1 bias. |
| `src/components/chart/CandlestickChart.tsx` | New optional `setupLabel` prop renders a small badge inside the chart canvas (bottom-left), color-coded by direction and dimmed when verdict is `no_trade`. |
| `src/pages/PairDetail.tsx` | Removed the standalone `usePairAnalysis(pair)` query. `analysis` is now derived from `enrichedSignals[0].analysis`. SetupContextBar rendered above the chart. Active Signals list shows quality badge + RR. |

### Removed frontend derivations

- `computeRR()` is now a **fallback only**. It runs only for legacy
  rows that pre-date this migration. Once `generate-signals` runs once
  after deploy, every active signal will have a persisted
  `risk_reward`, and the fallback can be deleted (TODO marker in
  `use-signals.ts:7`).
- Setup quality is read from `analysis.setupQuality` (never derived).
- Verdict, confidence, market structure, and HTF bias are all read
  from persisted DB columns — no client-side computation.

---

## Where each UI element gets its data

| UI element | Source | Path |
|---|---|---|
| Chart candles | `ohlcv_candles` table | `useCandlesWithFetch` |
| Chart EMA overlays | derived from candles | `calculateEMA` (pure) |
| Chart price lines (entry/SL/TP) | `pair_analyses` (FK-linked) | `enrichedSignals[0].analysis` |
| Chart support/resistance lines | `market_data_cache` | `useMarketData` |
| Chart signal markers | `signals` rows for the pair | `enrichedSignals` |
| Chart setup label badge | `signals` + verdict | `enrichedSignals[0]` |
| SetupContextBar (setup, dir, conf, verdict, quality) | `signals` + linked `pair_analyses` | `enrichedSignals[0]` |
| SetupContextBar (structure, D1 bias) | `market_data_cache` | `useMarketData` |
| Setup Analysis card | `pair_analyses` (FK-linked) | `enrichedSignals[0].analysis` |
| Active Signals list (direction, type, quality, RR, conf) | `EnrichedSignal[]` | `enrichedSignals` |
| Signal Explorer table RR column | `EnrichedSignal[]` | `useSignals().enriched` |
| Bias cards (D1/H1/vol/structure) | `market_data_cache` | `useMarketData` |

---

## Key design decisions

1. **FK join, not name join.** `pair_analyses` is fetched via
   `signal_id` FK rather than by `pair` name + latest `created_at`.
   Multiple analyses per pair no longer cause the chart and the setup
   card to display different rows.
2. **Derive `analysis` from the active signal** instead of running a
   parallel `usePairAnalysis(pair)` query. Single fetch path → no
   chance of divergence.
3. **`computeRR` retained as a temporary fallback** to avoid breaking
   display on legacy signal rows. Marked with a removable TODO.
4. **`SetupContextBar` is pure presentation** (no hooks). PairDetail
   composes the props from `enrichedSignals` + `useMarketData`. The
   strip is reusable elsewhere (e.g., a future Signal Detail page).
5. **`setupLabel` is optional** on `CandlestickChart`. Existing
   call-sites (none yet besides PairDetail) keep working unchanged.
6. **No type regeneration.** Following the Phase 3 pattern, the new
   `risk_reward` column is read via a narrow type cast rather than
   regenerating `src/integrations/supabase/types.ts`.

---

## How to verify

1. `npx tsc --noEmit` — passes.
2. `npx vite build` — passes.
3. Apply the migration: `supabase db push` (or run the SQL directly).
4. Trigger one `generate-signals` run so all active signals get
   `risk_reward` populated.
5. Open a pair detail page for a pair with an active signal:
   - The `SetupContextBar` shows setup type, direction icon, verdict,
     confidence bar, quality badge, market structure, D1 bias.
   - The chart shows a setup label badge (bottom-left) with the same
     direction / setup type / confidence / verdict.
   - The Setup Analysis card shows the same setup type and confidence.
   - The Active Signals list shows the same RR and quality badge.
   - The Signal Explorer table (`/signals`) shows the same RR for the
     same signal id.
6. Open a pair with **no** active signal — the SetupContextBar shows
   the "No active setup" fallback line; the chart has no setup label;
   the Setup Analysis card shows the empty state.

---

## TODOs left for a future phase

- Delete `computeRR` and its `resolveRiskReward` fallback once all
  active signals have a persisted `risk_reward` (one regeneration run
  after this deploy).
- Regenerate `src/integrations/supabase/types.ts` so `risk_reward`
  becomes a typed column and the cast in `resolveRiskReward` /
  `useSignalsByPair` can be removed.
- Consider rendering the SetupContextBar on the Signal Detail page
  too, since it is pure presentation.
