# Phase 18 — Implementation Summary

_Signal → trade → journal → AI post-trade review._

Phase 18 taught PipPilot the difference between **signal quality**
(was the setup good?) and **execution quality** (did the trader take
the setup cleanly?). The app can now compare what a signal planned
against what the user actually did and explain, in plain English,
whether a loss was the signal's fault, the trader's fault, or a
normal in-plan outcome.

This document is the high-level summary. The operational feature
doc is **`TRADE_REVIEW_WORKFLOW.md`** and the schema reference is
**`DATABASE_SCHEMA.md`**.

---

## 1. What changed — phase by phase

| Phase | Focus | Key files | Commit |
|---|---|---|---|
| **18.1** | Data model foundation | `20260418100000_add_executed_trades.sql`, `types.ts`, `DATABASE_SCHEMA.md` | `4b6d491` |
| **18.2** | Demo vs real separation across the app | `20260418110000_add_account_mode_to_journal.sql`, `account-mode-badge.tsx`, `SettingsPage.tsx`, `Journal.tsx`, `use-journal.ts`, `use-account.ts`, `use-daily-risk.ts`, `use-analytics.ts` | `34f1dc3` |
| **18.3** | Signal-to-trade execution flow | `TakeTradeDialog.tsx`, `use-executed-trades.ts`, wired into `SignalDetail.tsx`, `SignalDetailDrawer.tsx`, `Journal.tsx` | `d285e65` |
| **18.4** | Trade close + structured journaling | `20260418120000_extend_journal_fields.sql`, `CloseTradeReviewDialog.tsx`, `OpenTradesPanel.tsx`, `trade-pnl.ts`, `JournalDetailDrawer.tsx` review fields | `6a816cd` |
| **18.5** | Rule-based post-trade analysis engine | `20260418130000_add_trade_analyses.sql`, `src/lib/trade-analysis/` (types, rules, scoring, analyze), `use-trade-analyses.ts`, `TradeAnalysisCard.tsx` | `4bbbc4b` |
| **18.6** | Natural-language post-trade review | `src/lib/trade-analysis/summarize.ts`, headline + body rendering in `TradeAnalysisCard.tsx` | `35410ea` |
| **18.7** | Trade-performance analytics split | `src/lib/trade-analytics/` (types, aggregate), `use-trade-analytics.ts`, `Analytics.tsx` page, sidebar nav entry | `d2d6cda` |
| **18.8** | UX polish + guardrails | `UnjournaledTradesReminder.tsx`, `journalOnly` mode on close dialog, 5-option quick filter, dashboard mode badge | `7d5d0dd` |
| **18.9** | Tests, docs, implementation summary | `src/lib/trade-build/` pure helpers + tests, `mode-separation.test.ts`, `TRADE_REVIEW_WORKFLOW.md`, this file | _this commit_ |

Every phase shipped independently — its own plan, commit, and push —
so any sub-phase can be reverted in isolation if needed.

---

## 2. Key design decisions and why

### A separate `executed_trades` table, not extended journal columns

We explicitly rejected the "just add 25 columns to `trade_journal_entries`"
option. The journal is the trader's **retrospective diary**; `executed_trades`
is the **objective execution record**. Merging them would bloat every row
consumed by journal hooks with execution-engine concerns and muddle the
conceptual separation that Phase 18.5 (rule engine) and Phase 18.7
(analytics split) rely on. Instead we added a nullable
`trade_journal_entries.executed_trade_id` FK and let the two tables evolve
independently.

### `planned_*` as a snapshot, not a join

Every `planned_*` column on `executed_trades` is a **copy** of the signal
as it existed at take-trade time — entry zone, stop, TP1/TP2, confidence,
setup type, timeframe, full AI reasoning text. Signals can be edited,
invalidated, or deleted; joining at read time would silently rewrite what
the trade intended to do and make the rule engine lie. The snapshot is the
source of truth for "what did the trader sign up for?".

### `account_mode` denormalized onto every downstream row

`trading_accounts.account_mode` is the source of truth, but `executed_trades.account_mode`
and `trade_journal_entries.account_mode` are **denormalized** copies at
write time. This prevents a user from flipping an account from demo to
real months later and retroactively rewriting the mode of every historical
trade on that account. The Phase 18.9 `mode-separation.test.ts` suite
pins this invariant with 6 guardrail tests.

### Rule thresholds as fractions of planned risk, not absolute pips

Every drift rule in `src/lib/trade-analysis/rules.ts` expresses its
threshold as a fraction of the trade's own `plannedRiskDistance` — 20% for
entry drift, 20% for stop distance change, 20% for R:R. A 5-pip drift is
huge on EUR/USD M15 and noise on XAU/USD H4; an absolute constant would be
wrong everywhere. The fraction-based approach is calibration-free across
pairs and timeframes.

### Rules first, NL second

Phase 18.5 persists a deterministic `trade_analyses` row with flags,
scores, and a canonical `primary_outcome_reason`. Phase 18.6's
`summarizeAnalysis()` is a pure template-based renderer that takes that
row and produces `{headline, body, nextAction}` — no LLM, no network,
instant. The summary is **computed on the fly and never persisted**, so
template edits take effect on every existing analysis row with no
backfill. A future phase can add an optional LLM rewrite on top, but the
app must always have a correct deterministic fallback.

### Signal analytics and trade analytics are separate modules

`src/lib/analytics/` is the Phase 11 signal analytics: it reports on
`signal_outcomes` independent of whether any user actually traded them.
`src/lib/trade-analytics/` is Phase 18.7: it reports on what users did
with their actual money. They **never share aggregation code**. If a future
view needs both, compose at the UI layer — never merge at the data layer.

### Pure helpers for the UI → DB hot path

Phase 18.9 extracted `buildExecutedTradeFromSignal`,
`buildManualExecutedTrade`, and `buildJournalFromClose` into
`src/lib/trade-build/`. These are the functions the two dialogs call to
build insert payloads, and they are the functions where a missed field or
a subtle null-normalization would cause a data-quality bug. Isolating them
into pure modules means the contract is unit-testable without React.

### Soft-fail everywhere the trade is the source of truth

Trade analysis persistence is wrapped in try/catch and the hook's
`onError` raises a toast but never aborts the close flow. Same for the
journal insert — if it fails, the trade is still closed correctly. The
trade is always the authoritative state; everything derived from it can
be recomputed.

---

## 3. Test summary

**~260 tests across 23 suites.** The Phase-18-specific tests:

| Suite | Tests | Covers |
|---|---|---|
| `trade-pnl` | 10 | Direction-aware pip math, USD / account-% conversion, breakeven tolerance |
| `trade-analysis/analyze` | 24 | 11 rule checks + outcome classification + scoring (long/short, JPY, manual, invalidated, open, cancelled, breakeven) |
| `trade-analysis/summarize` | 23 | Per-outcome headlines + bodies, drift-clause Oxford-comma joining, confidence tier framing, fake-certainty discipline |
| `trade-analytics/aggregate` | 15 | Summary math, mode/source splits, outcome bars, mistake tags, 2×2 signal-vs-execution matrix, `filterRows` |
| `trade-analytics/mode-separation` | 6 | Guardrails that demo + real never silently combine |
| `trade-build/build-executed-trade` | 9 | Signal snapshot correctness — planned_* copy contract, later signal edits never rewrite earlier trade payloads |
| `trade-build/build-journal-from-close` | 10 | Journal auto-prefill — planned snapshot + actuals + structured review fields + rounding + null normalization |

Running the full suite takes under 30 seconds locally. All green.

---

## 4. Known limitations

These are documented intentional gaps, not bugs. They each have a
corresponding follow-up in the next section.

1. **No broker-level auto-close.** The Phase 14 broker read-only
   integration still doesn't know about `executed_trades`. A trade closing
   at the broker level doesn't automatically patch the internal trade
   row; the user has to click Close in `OpenTradesPanel`. Phase 18.8's
   `UnjournaledTradesReminder` catches the orphans, but it can't
   auto-reconcile them.
2. **`liveSignalStatus` is always `null` at close time.** The rule
   engine has a branch for `signal_invalidated`, but the close dialog
   doesn't fetch the live `signals.status` before running the engine. A
   future background recompute job should re-run `analyzeTrade()` on the
   latest signal state.
3. **No backfill for pre-Phase-18.5 closes.** Trades closed before the
   rule engine existed have `trade_analyses IS NULL`. A one-off admin
   script can iterate and upsert them later.
4. **Screenshots are plain text URL inputs.** No file upload via
   Supabase Storage. The `screenshot_before` / `screenshot_after` columns
   hold whatever URL the user pastes.
5. **Legacy journal rows default to `'demo'`.** Phase 18.2 deliberately
   chose `'demo'` as the safe default when adding `account_mode` to
   `trade_journal_entries`, rather than auto-tagging legacy rows based on
   their current default account — which would silently mislabel real
   trades. Users who had real journal entries pre-18.2 must retag them
   manually.
6. **The 2×2 signal-vs-execution quadrant only counts scored trades.**
   Manual trades drop out because they have `null` signal and execution
   scores. The Analytics page labels the quadrant card with an "X scored
   trades" footer so users see when the matrix is data-starved.
7. **Single rule version.** `rule_version = 'v1'` is stamped on every
   `trade_analyses` row. When the rule set eventually changes, old rows
   keep their v1 output until a background recompute runs — code that
   compares v1 and v2 outputs side-by-side does not exist yet.
8. **No date-range picker on Analytics.** The filter bar has the
   5-option segmented control (all/demo/real/linked/manual). The
   underlying `filterRows` already accepts `since` / `until` strings;
   wiring a date picker is straightforward future work.
9. **Mobile nav doesn't surface `/analytics`.** The bottom bar is already
   at 6 items; adding a 7th would overflow. Desktop is the primary surface
   for analytics. Mobile users can still navigate via URL.

---

## 5. Recommended follow-up enhancements

In roughly priority order:

1. **Broker auto-close reconciliation.** When the Phase 14 broker sync
   detects that an `open_positions` row the user previously linked to an
   `executed_trades` row is no longer present at the broker, auto-patch
   the executed trade with a close (using broker-reported exit price) and
   create the analysis row. The `UnjournaledTradesReminder` would then
   show these for the user to review.
2. **Background rule-engine recompute.** A nightly (or on-signal-state-
   change) job that re-runs `analyzeTrade()` on open + recently-closed
   trades with the latest `signals.status`. This finally lets
   `signal_invalidated` fire correctly for trades that were invalidated
   after the user closed them.
3. **Per-pair and per-setup breakdowns in Analytics.** The aggregator
   already has all the data; adding `byPair` and `bySetup` summaries plus
   two more `BreakdownCard` renders is a small change. Lets users see "my
   breakout setups have 70% win rate but my pullback setups lose money".
4. **Screenshot uploads via Supabase Storage.** A small file-input +
   signed-URL flow in the close dialog, and a thumbnail renderer in the
   journal drawer.
5. **Personalized mistake patterns.** Use the persisted `mistake_tags`
   to detect patterns across time — "You made FOMO entries 6 times this
   month, all on Tuesday mornings". A lightweight pattern-detection pass
   in the aggregator, a new analytics card.
6. **Real vs demo behavior comparison trends.** An explicit "Are you
   trading differently when it's real money?" view that diffs demo and
   real `byMode` summaries and flags behavioral drift (e.g. oversizing
   more on real, tighter stops on real, etc.). The data already supports
   this; it's a new Analytics card.
7. **Richer behavioral coaching.** Phase 18.6's NL summarizer currently
   uses deterministic templates. An optional LLM rewrite pass that takes
   the structured flags + scores + improvement_actions as input could
   produce more varied, personalized prose. Must still fall back to the
   deterministic templates when the LLM call fails.
8. **Trade drill-down from Analytics.** Clicking a bar in the outcome
   breakdown or a mistake-tag chip should filter the Journal table to the
   matching trades. Hook already exposes `rows`; just needs a URL param
   plus filter-state wiring.
9. **`useJournalStats` mode requirement.** Phase 18.2 made
   `useDashboardJournalStats` type-require a `mode`. `useJournalStats`
   (the other aggregate hook) still takes raw entries and lets callers
   filter externally. Making the mode required there too would be a
   belt-and-braces consistency fix.
10. **Inline editing of structured review fields.** Today the structured
    review fields (ratings, emotions, mistake tags) are only editable
    via `CloseTradeReviewDialog` (in either close-and-journal or
    `journalOnly` mode). The quick `JournalEntryForm` doesn't expose
    them. Extending that form would give users an edit path for
    existing journal rows without going through a dialog.
11. **Multi-language NL review.** The `summarizeAnalysis` templates are
    English-only. An i18n refactor in `summarize.ts` would unblock
    multi-language support cheaply — the templates are all in one file.
12. **Rule-version-aware analytics.** When `rule_version` eventually
    bumps past `v1`, analytics breakdowns should ideally group or label
    stale v1 rows so the user understands they're comparing apples to
    oranges if the rule set changed.

---

## 6. Changelog (concise)

```
Phase 18 — Signal → Trade → Journal → AI Review
  18.1  Data model: executed_trades + account_mode + executed_trade_id FK
  18.2  Demo vs real first-class across hooks, queries, UI
  18.3  Take Trade action + TakeTradeDialog with signal snapshot
  18.4  Close & Journal dialog, OpenTradesPanel, structured review fields
  18.5  Deterministic post-trade rule engine + trade_analyses persistence
  18.6  Pure-template natural-language review in TradeAnalysisCard
  18.7  Dedicated Analytics page with mode/source/outcome/mistake/quadrant
  18.8  Unjournaled reminder, journalOnly close mode, 5-option quick filter
  18.9  Pure payload builders, mode-separation tests, feature + summary docs
```

---

_End of Phase 18 implementation summary._
