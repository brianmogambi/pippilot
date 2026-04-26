# UX Improvement Plan v1

> An eight-phase, client-side-first improvement pass over PipPilot AI focused on **signal trust, beginner-friendliness, and the learning loop**. Shipped April 2026 against the post-Phase-18 codebase.

⚠️ *AI-assisted analysis only — not financial advice. Trading carries significant risk.*

---

## Why this plan

PipPilot's deterministic engine + AI explanation layer + post-trade analysis pipeline were already strong (see [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) and [SIGNAL_ENGINE_SPEC.md](SIGNAL_ENGINE_SPEC.md)). What was missing was the **glue between data and decision** for a beginner: signals didn't explain why they could fail, the take-trade dialog didn't show potential loss in dollars, jargon went unexplained, the journal's rule-engine output wasn't surfaced as visible lessons, and stale signals rendered identically to fresh ones.

This plan delivers small, safe, phase-gated changes that add up to: **every signal explains itself, every trade is risk-aware before it's placed, beginners get glossary tooltips and conservative defaults without forking the UI, the dashboard guides the user through a clear "what to do today" flow, and post-trade lessons feed back into the experience.**

## Guiding principles

1. **Reuse, don't rebuild.** `evaluateTrade()`, `usePipValue()`, `useDailyRiskUsed()`, `freshnessOf()`, `EnrichedSignal`, `AccountModeBadge`, `FreshnessBadge`, `StatusBadge`, `EmptyState` — every phase leans on these.
2. **Pure modules first.** Heuristics and presentation logic live in `src/lib/*.ts` with vitest coverage before they touch components.
3. **Client-side derivations** for the new "trust signals" — no Edge Function or DB migration in any phase.
4. **Beginner UI is a layer, not a fork.** Same components; conditional helpers/tooltips/copy when `profile.experience_level === "beginner"`.
5. **Phase-gated.** Each phase is a single coherent commit, summarised + verified before the next.

---

## Phase 1 — Signal Trust Layer

**What shipped:** Every signal card now answers *why might this fail, is it beginner-friendly, demo or real, how old is it, what's my potential loss?*

**Files:**
- New: `src/lib/signal-presentation.ts` (28 vitest specs in `src/lib/__tests__/signal-presentation.test.ts`).
  - `getBeginnerFriendlyTag(signal)` — heuristic: trade verdict + A+/A quality + ≥70% confidence + ≥2R.
  - `getAccountSuitability(signal)` — `real` / `demo_only` / `no_trade`.
  - `getPrimaryRisk(signal)` — first item from `analysis.reasonsAgainst`, with confidence/R:R fallback.
  - `getSignalAge(signal)` — `fresh` (<2h) / `aging` (2–6h) / `stale` (>6h).
  - `getPotentialLoss(balance, riskPct)` — translates "X% of account" into a dollar amount.
- Updated: `src/pages/Index.tsx` (`TopTradeCard` shows age, suitability, primary risk, potential loss), `src/components/signals/SignalCard.tsx`, `src/components/signals/SignalDetailDrawer.tsx` (promoted "Why this could fail" callout above Price Levels).

## Phase 2 — Risk-Before-Trade Safety

**What shipped:** A live risk preview inside `TakeTradeDialog` and a hard-block when the trade would exceed the daily-loss cap.

**Files:**
- Updated: `src/components/trades/TakeTradeDialog.tsx` — Risk Preview panel showing potential loss in $, % of account, and daily-budget gauge scoped to the SELECTED account's mode. Submit button disabled with reason text when projected daily risk exceeds `max_daily_loss_pct`. Conservative-mode toggle seeds from the user's profile and can be overridden per-dialog. One-line risk reminder added directly above submit.
- Updated: `src/hooks/use-daily-risk.ts` — `useDailyRiskUsed()` extended with optional `{ accountMode, balance }` overrides (so the dialog can preview risk for a non-default account) and now also returns `riskUsedUsd`. Backward-compatible.

## Phase 3 — Beginner Mode v1

**What shipped:** Glossary tooltips on jargon labels everywhere, calculator preset chips, and auto-applied conservative settings for users who self-identified as beginners.

**Files:**
- New: `src/lib/glossary.ts` — 18 typed entries (pip, lot, spread, leverage, margin, drawdown, stop_loss, take_profit, risk_reward, risk_pct, confidence, setup_quality, volatility, atr, ema, rsi, session, trend) with `short` (1-line) and `long` (full beginner-mode) descriptions.
- New: `src/components/ui/term-tooltip.tsx` — wrapper over shadcn `Tooltip` that always shows the short text and appends the long text in beginner mode. Three modes: `underline`, `icon`, `wrap`.
- New: `src/hooks/use-beginner-mode.ts` — one-line hook returning `profile?.experience_level === "beginner"`.
- Updated: `src/components/calculator/RiskCalculator.tsx` — preset chips above the form (Beginner 1%/half · Standard 2% · Aggressive 3%); beginner preset auto-applied once on mount via guarded `useEffect`. Field/ResultCell helpers extended with `term` props; Stop Loss / SL pips / Risk % per Trade input labels and Max Risk / Lot Size / Pip Value / Exposure result cells all tooltipped.
- Updated: `src/pages/Index.tsx` (TopTradeCard + AccountBar labels), `src/components/signals/SignalDetailDrawer.tsx` (Price Levels, Setup Info), `src/pages/Watchlist.tsx` (column headers).

## Phase 4 — Dashboard "What to do today" Flow

**What shipped:** A 4-step welcome strip, journal stats expanded by default, stale-signal banner on the top trade, calculator pre-fill from any signal, and a multi-account switcher popover.

**Files:**
- New: `src/components/dashboard/WelcomeStrip.tsx` — sessionStorage-backed dismissal and per-step "done" tracking.
- Updated: `src/pages/Index.tsx` — renders `<WelcomeStrip />`, flips `journalExpanded` initial state to `true`, adds the stale-signal banner inside `TopTradeCard`, adds a "Calculate lot size" CTA (programmatic `useNavigate` to avoid nested anchors), introduces an inline `AccountSwitcher` popover for multi-account users (single-account users see the existing static badge).
- Updated: `src/hooks/use-account.ts` — `useUpdateTradingAccount` payload now accepts `is_default`.
- Updated: `src/pages/CalculatorPage.tsx` — reads `?pair=`, `?entry=`, `?sl=` query params via `useSearchParams` and forwards to the calculator.
- Updated: `src/components/calculator/RiskCalculator.tsx` — `Props` extended with optional `defaultPair`, validated against the pair list before use.

## Phase 5 — Journal Learning Loop

**What shipped:** The existing post-trade rule-engine output (`trade_analyses` rows from Phase 18.5) is now surfaced as visible lessons across the dashboard, the journal drawer, and the signal drawer.

**Files:**
- Updated: `src/hooks/use-trade-analyses.ts` — added `useRecentLessons(mode, limit)` (last N distinct improvement actions across the user's recent trade_analyses, mode-scoped via `executed_trades.account_mode`) and `useRecurringOutcomeCount(executedTradeId, primaryOutcomeReason)` (count of OTHER trades sharing the outcome reason in last 30 days; intentionally skips win/open/manual reasons).
- Updated: `src/hooks/use-journal.ts` — added `useRecentSetupLosses(pair, setupType)` (count of journaled losses on the same pair+setup in last 30 days; mode-agnostic).
- Updated: `src/pages/Index.tsx` — new "Recent lessons" card under the Journal & Tips panel, hidden when empty.
- Updated: `src/components/journal/JournalDetailDrawer.tsx` — new "seen N× recently" recurring-mistake badge in the header, fires only on losing/non-trivial outcomes.
- Updated: `src/components/signals/SignalDetailDrawer.tsx` — "You've struggled here recently" caution strip when the user has 2+ journaled losses on this pair+setup in the last 30 days. Doesn't block — just raises the bar.
- Bug fix carried over from Phase 4: the inner "Calculate lot size" `<Link>` on the TopTradeCard became a `<button>` with `useNavigate` to eliminate nested-anchor DOM validation warnings.

## Phase 6 — Watchlist & Navigation Glue

**What shipped:** Closed the navigation gaps that forced users to backtrack — clickable signal badges, calculator promoted into the mobile nav, alert-toggle helper text, and a calculator shortcut on the signal drawer.

**Files:**
- Updated: `src/pages/Watchlist.tsx` — per-row signal badge wrapped in a `<Link to={`/signals/${r.signal.id}`}>` with `e.stopPropagation()`. Existing `useActiveSignals` data already enriched onto each row via `signalMap`, so no new query.
- Updated: `src/components/layout/MobileNav.tsx` — Learn dropped, Calculator added (labeled "Sizing" to fit the bottom-bar). Phase 3's tooltips already cover in-context glossary needs.
- Updated: `src/pages/PairDetail.tsx` — each Alert Controls toggle now carries a one-line helper underneath ("Fires when price enters the suggested entry band." / "Fires when the setup confirms…" / "Fires when a TP, SL, or invalidation level is touched.").
- Updated: `src/components/signals/SignalDetailDrawer.tsx` — primary action row hosts both "Take This Trade" and a new "Calculate lot size" outline button (`asChild` over a `<Link>` to `/calculator?pair=…&entry=…&sl=…`).

## Phase 7 — Disclaimers, Stale Data, and Trust Signals

**What shipped:** Disclaimer placement and stale-data warnings the user can't miss before acting.

**Files:**
- Updated: `src/components/layout/AppHeader.tsx` — global Data freshness pill (`useSignalFreshness()`) at the start of the header right cluster. Click → popover explaining Live / Cached / No-data with the auto-refresh footer note.
- Updated: `src/components/signals/SignalDetailDrawer.tsx` — Stale-signal banner mirroring the dashboard `TopTradeCard` banner; fires when `getSignalAge(signal).staleness === "stale"`.
- Updated: `src/components/trades/TakeTradeDialog.tsx` — One-time-per-session acknowledgment checkbox ("I understand PipPilot AI provides educational analysis only — not financial advice — and that I am responsible for the trades I take."). Stored in `sessionStorage` under `pippilot.takeTrade.acknowledged`. Hidden after the first ack so it doesn't re-friction every subsequent trade in the session.

The onboarding wizard's existing "PipPilot AI provides AI-assisted analysis, not financial advice" disclaimer at step 3 was re-confirmed and left in place.

## Phase 8 — Architecture Polish

**What shipped:** Wired the only orphan export (`getBeginnerFriendlyTag` from Phase 1) into the SignalDetailDrawer as a beginner-only "Beginner-friendly" pill, then ran final lint/typecheck/tests.

**Files:**
- Updated: `src/components/signals/SignalDetailDrawer.tsx` — beginner-friendly pill (Sparkles icon, bullish variant) gated on `useBeginnerMode() === true` AND the engine's heuristic agreeing.

**Deliberately skipped:**
- **Did not consolidate `freshnessOf()` and `signalFreshnessOf()`.** Different thresholds (10 min for market data vs. 4 h for signals) — they answer different questions. Sharing implementation would be over-abstraction for two ~6-line functions.
- **Did not rename `useDashboardAlerts` → `useLimitedAlerts` or `useDashboardWatchlist` → `useLimitedWatchlist`.** The project has a consistent `Dashboard*` family (`useDashboardJournal`, `useDashboardJournalStats`, `useDashboardAlerts`, `useDashboardAlertsEnriched`, `useDashboardWatchlist`); renaming just two would create new asymmetry.
- **Did not touch `src/types/trading.ts`.** Risk of breaking `EnrichedSignal` consumers outweighed the marginal cleanup.

---

## Verification

- `npx tsc --noEmit` → clean across all phases.
- `npx vitest run` → 294/294 pass (266 existing + 28 new in `signal-presentation.test.ts`).
- `npx eslint` on every touched file → no errors, no warnings introduced. Pre-existing warnings (`Number(entry.result_pips) ?? 0` in Index.tsx, `entry: any` in JournalDetailDrawer) remain — flagged for a separate cleanup task.
- Browser preview at desktop width verified: header freshness pill + popover, top trade card with all four trust-signal pieces, stale banner, "Calculate lot size" CTA, drawer with stale + recurring-mistake + beginner-friendly pills, dialog with risk preview + acknowledgment checkbox + over-cap blocking.

## Useful side discoveries

- The current production signal data tops out at R:R ≈ 1.5R across every active signal in the table. The new `getBeginnerFriendlyTag` heuristic (R:R ≥ 2) is stricter than the engine's typical output, so the beginner-friendly badge correctly suppresses for the entire current dataset. When a 2R+ A-grade setup appears, the badge will appear automatically. **By design** — beginners should be more selective.
- XAU/USD's pip math produces enormous pip distances ("70100-pip stop" for a 7-point move) inside the calculator. `pipMultiplier()` in `src/lib/pip-value.ts` likely treats gold as a 4-decimal forex pair instead of a 1:1 instrument. **Pre-existing bug**, orthogonal to this plan, flagged for a future fix.

## What this plan did NOT do (out of scope)

- Lift the heuristics in `signal-presentation.ts` into `pair_analyses` columns. Deferred until the heuristics are validated against real journal data — see Roadmap "Phase 20".
- Confidence recalibration from journal outcomes — see Roadmap "Phase 19".
- Real broker execution from PipPilot. The `broker/` adapter layer remains a read-only sync stub.
- Onboarding tour overlay — Phase 4's WelcomeStrip is the lighter approximation.
- A new `profile.beginner_mode` boolean column. Beginner mode is auto-derived from `profile.experience_level` per the user's choice during planning.
