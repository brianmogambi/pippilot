# Signal → Trade → Journal → AI Review Workflow

_Feature doc for the Phase 18 workflow (sub-phases 18.1 – 18.9)._

This document describes the end-to-end data flow and the surfaces a
trader touches, from the moment an AI signal is generated to the
moment they see a post-trade review explaining why a trade won or
lost. It is the canonical source for anyone extending the feature in
a future phase.

If you want a concise summary of what each sub-phase shipped and
the recommended next steps, see **`PHASE_18_SUMMARY.md`**.

---

## 1. Mental model

The app has always rated signals. Phase 18 teaches it the difference
between **how good the signal was** and **how well the user executed
it**. Those two questions are answered by two independent stores:

| Question | Source of truth |
|---|---|
| *Did the signal pattern play out?* | `signals` + `signal_outcomes` (Phase 10/11) |
| *Did the user make money on the trades they took?* | `executed_trades` + `trade_analyses` (Phase 18) |

These are **never joined at the aggregation layer**. Mixing them would
let a trader's execution mistakes drag down the raw signal
model-performance report, which is the failure mode the whole feature
was built to prevent.

There is also a clean distinction between the **objective execution
record** and the trader's **subjective review**:

| Concept | Table |
|---|---|
| What actually happened in the market | `executed_trades` |
| What the trader wrote about it | `trade_journal_entries` |
| Rule-engine verdict on the gap between plan and execution | `trade_analyses` |

A journal entry links back to an executed trade via
`trade_journal_entries.executed_trade_id` but neither row "owns" the
other — you can have an executed trade with no journal entry (the
user skipped the review) and a journal entry with no executed trade
(legacy rows that predate Phase 18).

---

## 2. Schema

All four tables are in the `public` schema with RLS enabled. Full
column tables live in `docs/DATABASE_SCHEMA.md`; this section shows
just the Phase-18 surface area.

```
trading_accounts
  + account_mode text ('demo' | 'real', default 'demo')  -- 18.1

executed_trades                                           -- 18.1
  * user_id, account_id, account_mode (snapshotted)
  * signal_id (nullable = manual trade)
  * symbol, direction
  * planned_entry_low / planned_entry_high
  * planned_stop_loss
  * planned_take_profit_1 / planned_take_profit_2
  * planned_confidence, planned_setup_type, planned_timeframe
  * planned_reasoning_snapshot
  * actual_entry_price, actual_stop_loss, actual_take_profit,
    actual_exit_price
  * lot_size, position_size
  * opened_at, closed_at
  * result_status (open | win | loss | breakeven | cancelled)
  * pnl, pnl_percent, broker_position_id, notes

trade_journal_entries
  + account_mode (default 'demo', denormalized from account)  -- 18.2
  + executed_trade_id                                         -- 18.1
  + emotion_before / emotion_after                            -- 18.4
  + setup_rating / execution_rating / discipline_rating       -- 18.4
  + mistake_tags text[]                                       -- 18.4
  + screenshot_before / screenshot_after                      -- 18.4

trade_analyses                                                -- 18.5
  * executed_trade_id (UNIQUE — one analysis per trade)
  * flags text[], details jsonb
  * signal_quality_score, execution_quality_score,
    discipline_score, risk_management_score (all 0-100)
  * primary_outcome_reason (9-bucket check constraint)
  * improvement_actions text[]
  * rule_version text (default 'v1')
```

Three migrations land the schema:

- `20260418100000_add_executed_trades.sql` — Phase 18.1
- `20260418110000_add_account_mode_to_journal.sql` — Phase 18.2
- `20260418120000_extend_journal_fields.sql` — Phase 18.4
- `20260418130000_add_trade_analyses.sql` — Phase 18.5

**Design note on the `planned_*` snapshot.** The fields are a full
copy of the signal as it existed at take-trade time, NOT a live join.
Signals can be invalidated, edited, or deleted, so joining at read
time would silently rewrite what the trade "planned" to do. Phase
18.5's rule engine relies on the snapshot being frozen.

**Design note on denormalized `account_mode`.** It lives on
`trading_accounts`, on `executed_trades`, AND on
`trade_journal_entries`. The latter two are snapshotted at write
time. This prevents a user from flipping an account from demo to
real and retroactively rewriting the mode of every trade they ever
took on that account.

---

## 3. Data flow

```
 ┌─────────────┐
 │   Signal    │  (signals + pair_analyses)
 └──────┬──────┘
        │  user clicks "Take Trade" on SignalDetail / SignalDetailDrawer
        ▼
 ┌────────────────────┐       buildExecutedTradeFromSignal()
 │ TakeTradeDialog    │ ───► snapshots planned_* from the live signal,
 │  (or manual trade) │      captures actual_* from the form
 └──────┬─────────────┘
        │  useCreateExecutedTrade.mutate()
        ▼
 ┌──────────────────┐
 │ executed_trades  │  result_status = 'open'
 └──────┬───────────┘
        │  user clicks "Close" on the Journal OpenTradesPanel
        ▼
 ┌───────────────────────┐
 │ CloseTradeReviewDialog│
 │  1. live P&L preview  │
 │  2. optional review   │
 │     fields + ratings  │
 └──────┬────────────────┘
        │  handleSubmit branches into 3 writes:
        │
        ├──►  useCloseExecutedTrade   (patch result_status + pnl)
        │
        ├──►  analyzeTrade() + useUpsertTradeAnalysis
        │     (rule engine + upsert into trade_analyses)
        │
        └──►  buildJournalFromClose() + useCreateJournalEntry
              (insert trade_journal_entries with executed_trade_id FK)

        ▼
 ┌─────────────────────────────────────────┐
 │ JournalDetailDrawer                     │
 │   <TradeAnalysisCard analysis=... />    │
 │     headline + body (summarizeAnalysis) │
 │     score bars + flag chips             │
 │     improvement actions                 │
 └─────────────────────────────────────────┘
```

### The rule engine (`src/lib/trade-analysis/`)

**Inputs** — `TradeAnalysisInput` has every field the rules need:
direction, pair, the `planned_*` snapshot, actual execution, result
status, and optional `followed_plan` / `mistake_tags` lifted from the
linked journal row.

**Rules** — 11 deterministic checks in `rules.ts`. Every threshold is
expressed as a fraction of the trade's own planned risk distance
(`|plannedEntryMid − plannedStopLoss|`). This is the key calibration
decision: a 5-pip drift is huge on EUR/USD M15 and noise on XAU/USD
H4, so absolute pip thresholds would be wrong. Scaling to the setup's
own risk keeps the engine calibration-free across pairs + timeframes.

**Flags raised:** `late_entry`, `early_entry`, `tighter_stop_than_plan`,
`wider_stop_than_plan`, `reduced_rr`, `improved_rr`, `followed_plan`,
`deviated_from_plan`, `setup_failed_normally`, `signal_invalidated`,
`probable_execution_error`. Codes are append-only — never remove or
rename — because they are persisted in `trade_analyses.flags` and
downstream consumers (NL summarizer, analytics) depend on them.

**Scoring** — four independent 0-100 scores, each a specific lens on
"how did this trade go?". Manual trades correctly return `null` for
signal and execution quality (no plan to score against) while still
computing discipline + risk management from the trader's self-report.

**Outcome classification** — nine canonical buckets matching the
`primary_outcome_reason` check constraint on `trade_analyses`. The
classifier short-circuits to the right bucket for open, breakeven,
cancelled, manual-no-signal and invalidated cases before applying
the plan-adherence branches.

### The natural-language summarizer (`src/lib/trade-analysis/summarize.ts`)

`summarizeAnalysis()` takes the rule-engine output and returns
`{headline, body, nextAction}` via per-outcome templates. The
summarizer is pure, fast, and rendered on the fly by
`TradeAnalysisCard` — we never persist the prose, so a template edit
takes effect on every existing analysis row with no backfill.

**Tone discipline** is enforced by tests:

1. Loss attribution hedges (`appears` / `likely` / `suggests`) and
   never claims `definitely` / `certainly` / `always` / `never`.
2. In-plan losses are explicitly framed as "rather than an execution
   mistake" so the trader isn't scolded for a setup that simply
   didn't work out.
3. Manual trades never claim "this signal" was anything — confidence
   tier is omitted entirely.

---

## 4. Surfaces

| Surface | File | Phase |
|---|---|---|
| **Settings → Trading Accounts** (demo/real toggle) | `src/pages/SettingsPage.tsx` | 18.2 |
| **Signal Detail → Take Trade button** | `src/pages/SignalDetail.tsx` | 18.3 |
| **Signal Detail Drawer → Take This Trade CTA** | `src/components/signals/SignalDetailDrawer.tsx` | 18.3 |
| **Journal → Take Manual Trade button** | `src/pages/Journal.tsx` | 18.3 |
| **Journal → Unjournaled trades reminder** | `src/components/trades/UnjournaledTradesReminder.tsx` | 18.8 |
| **Journal → Open Trades panel** | `src/components/trades/OpenTradesPanel.tsx` | 18.4 |
| **Journal table → Mode column + AI link icon** | `src/pages/Journal.tsx` | 18.2 |
| **Journal Detail Drawer → Post-trade review card** | `src/components/journal/JournalDetailDrawer.tsx` + `TradeAnalysisCard.tsx` | 18.5 / 18.6 |
| **Analytics page** (`/analytics`) | `src/pages/Analytics.tsx` | 18.7 / 18.8 |
| **Dashboard → Account Bar mode badge** | `src/pages/Index.tsx` | 18.8 |

Dialogs:

- `TakeTradeDialog` — the canonical open-a-trade dialog. Two modes:
  signal-linked (snapshots `planned_*`) and manual (everything null).
- `CloseTradeReviewDialog` — close + optional review. Two modes:
  default (close + journal in one shot) and `journalOnly` (backfill a
  review for a trade that was already closed).

---

## 5. Account mode separation guarantees

Demo and real are treated as first-class orthogonal data. The
guardrails that prevent silent combination:

1. **Schema**: `account_mode` is stored on `trading_accounts`,
   `executed_trades`, and `trade_journal_entries`. The latter two
   snapshot from the account at write time so historical mode is
   never rewritten.
2. **Hooks**: every Phase-18 query hook (`useJournalEntries`,
   `useDashboardJournal`, `useJournalByPair`,
   `useDashboardJournalStats`, `useDailyRiskUsed`,
   `useOpenExecutedTrades`, `useUnjournaledClosedTrades`,
   `useJournalAnalytics`) accepts an optional `mode` filter that is
   threaded into the SQL `eq('account_mode', mode)`. Query keys
   include the mode so caches partition cleanly.
3. **Aggregation**: `aggregateTradeAnalytics()` returns
   `byMode.demo` and `byMode.real` as two independent summaries, not
   slices of a shared numerator. Unit-tested in
   `src/lib/trade-analytics/__tests__/mode-separation.test.ts`.
4. **Defaults**: `useDashboardJournalStats(mode)` **requires** a mode
   argument — combined stats would silently mix demo and real, so
   the type system prevents that mistake at the call site.
5. **UX**: `AccountModeBadge` is rendered in a distinct color palette
   (yellow for demo, green for real) so at a glance in the Dashboard
   AccountBar, Journal table rows, Settings accounts list,
   TakeTradeDialog, CloseTradeReviewDialog, OpenTradesPanel,
   UnjournaledTradesReminder, Analytics split cards, and
   JournalDetailDrawer header, the user always knows which mode
   they're looking at.

---

## 6. Test coverage

Phase 18 ships **260+ tests** across 23 suites. The subset specific to
the workflow:

| Module | Tests | What it guards |
|---|---|---|
| `src/lib/trade-pnl` | 10 | Pip math, win/loss/be classification, lot-size math, account-% |
| `src/lib/trade-analysis/analyze` | 24 | 11 rule checks + outcome classification + scoring |
| `src/lib/trade-analysis/summarize` | 23 | Per-outcome headlines/bodies, drift-clause joining, confidence tier framing, fake-certainty discipline |
| `src/lib/trade-analytics/aggregate` | 15 | Headline math, mode/source splits, outcome bars, mistake tags, quadrant matrix, `filterRows` |
| `src/lib/trade-analytics/mode-separation` | 6 | Guardrails that demo + real never silently combine |
| `src/lib/trade-build/build-executed-trade` | 9 | Signal snapshot correctness (the `planned_*` copy contract) |
| `src/lib/trade-build/build-journal-from-close` | 10 | Journal auto-prefill correctness |

The two `build-*` suites are the ones that catch UI-to-DB regressions
on the hot path. They unit-test the payload builders that the
`TakeTradeDialog` and `CloseTradeReviewDialog` call into, so a
wrong-field-copied bug in either dialog surfaces as a red test
rather than a silent data-quality issue.

---

## 7. Extending the workflow

**Adding a new rule flag:**
1. Append the new code to `TradeAnalysisFlag` in
   `src/lib/trade-analysis/types.ts`.
2. Write the rule function in `rules.ts`.
3. Wire it into `analyze.ts` via `pushHit()`.
4. Add a label + tone to `FLAG_LABELS` in `TradeAnalysisCard.tsx`.
5. Add a drift-phrase translation in `DRIFT_PHRASES` in
   `summarize.ts` if the flag should appear in the body prose.
6. Bump `TRADE_ANALYSIS_RULE_VERSION` from `'v1'` to `'v2'` if the
   rule changes existing scoring in a meaningful way.
7. Add unit-test scenarios in `analyze.test.ts` + (if prose-facing)
   `summarize.test.ts`.

**Adding a new mistake tag:**
1. Append to `MISTAKE_TAG_OPTIONS` in
   `src/components/trades/CloseTradeReviewDialog.tsx`.
2. Add a human label to `MISTAKE_TAG_LABELS` in
   `src/lib/trade-analytics/aggregate.ts`.
3. Optionally extend the rule engine's `probable_execution_error`
   check in `rules.ts` if the new tag should drive that flag.

**Adding an analytics axis (e.g. per-pair stats):**
1. Add a new builder in `src/lib/trade-analytics/aggregate.ts` that
   produces a `BreakdownBar[]` or a typed summary shape.
2. Attach it to the `TradeAnalyticsBreakdown` interface.
3. Render a new `BreakdownCard` in `src/pages/Analytics.tsx`.
