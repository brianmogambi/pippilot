# Phase 8 — Explanation Layer Hardening

Extracts the AI/template decision behind PipPilot's signal explanations
into a backend-safe service module, adds metadata so every persisted
explanation is traceable, and surfaces aggregate AI-call counters on
the existing `generation_runs` audit row.

---

## Why

Before Phase 8 the explanation layer had four hardening gaps:

1. **No traceability of AI vs template prose.** `signals.created_by_ai`
   was set to `true` unconditionally, even when `ANTHROPIC_API_KEY` was
   missing or the call had failed. There was no way for an audit (or
   the UI) to tell apart prose authored by Claude from prose authored
   by `generateExplanations()` in `signal-engine.ts`.
2. **Failures were only `console.error`'d.** A `generation_runs` row
   finished as `success` even when *every* AI call failed and the
   whole batch fell back to template text. Operators could not see
   explanation health from the runs dashboard.
3. **Prompt was hardcoded inline with no version.** A single string
   literal in the runner. Any tweak shipped silently and we could not
   correlate explanation quality drift with prompt edits.
4. **The explanation layer was jammed inside the runner.** It was not
   a separable module — there was no way to test the parser, the
   prompt builder, or the fallback decision in vitest, and the
   "AI never modifies numeric outputs" rule was enforced only by
   convention.

---

## Architecture

```
   ┌────────────────────────────────────┐
   │ supabase/functions/_shared/        │  pure: no React, no Supabase,
   │   signal-engine.ts                 │  no DOM/Node-only globals.
   │     • analyzeForSignal()           │
   │     • generateExplanations()  ◄────┼── deterministic template prose
   │     • generateReasons()       ◄────┼── deterministic template bullets
   └──────────┬─────────────────────────┘
              │
              ▼
   ┌────────────────────────────────────┐
   │ supabase/functions/_shared/        │  pure (apart from one fetch),
   │   explanation-service.ts           │  backend-safe.
   │     • generateExplanation()        │
   │     • parseAIResponse()            │
   │     • buildPromptContext()         │
   │     • buildSystemPrompt()          │
   │     • PROMPT_VERSION constant      │
   └──────────┬─────────────────────────┘
              │ called per signal
              ▼
   ┌────────────────────────────────────┐
   │ supabase/functions/generate-signals│
   │   • walks SignalOutput[]           │
   │   • stashes ExplanationResult on   │
   │     SignalOutput.explanationMeta   │
   │   • increments aiCounters          │
   │   • writes pair_analyses metadata  │
   │   • writes generation_runs counters│
   └──────────┬─────────────────────────┘
              │
              ▼
   ┌────────────────────────────────────┐
   │ pair_analyses                      │
   │   + explanation_source             │
   │   + explanation_status             │
   │   + explanation_model              │
   │   + explanation_prompt_version     │
   │   + explanation_generated_at       │
   │   + explanation_error_code         │
   │ generation_runs                    │
   │   + ai_calls_attempted             │
   │   + ai_calls_succeeded             │
   │   + ai_calls_failed                │
   │   + ai_calls_skipped               │
   └────────────────────────────────────┘
```

The runner is the only place that touches Supabase. The service is
the only place that knows about Claude. The signal engine is the only
place that produces deterministic templates. Each layer is testable
in isolation.

---

## Service contract

The rule "AI explains, never modifies numeric outputs" is now
**structurally** enforced rather than enforced by convention:

- The service receives a typed `ExplanationInputs` value (20
  deterministic, read-only fields) plus an `ExplanationFallback`
  value (5 text/array fields) — it never sees a `SignalOutput`
  reference, so it cannot mutate one.
- The service returns a fresh `ExplanationResult` value. The runner
  is the only place that assigns those text/array fields back onto
  the signal.
- The service never re-derives the fallback. `signal-engine.generateExplanations()`
  and `generateReasons()` (already pure) run before the AI call, and
  the service receives the result as `fallback`. Determinism is
  trivial: the same `(inputs, fallback)` always produce the same
  `ExplanationResult` for the same AI response.

```ts
export async function generateExplanation(args: {
  inputs: ExplanationInputs;
  fallback: ExplanationFallback;
  apiKey: string | null;
  fetchFn?: typeof fetch;   // injectable for tests
  now?: () => Date;          // injectable for tests
  logger?: (msg, meta) => void;
}): Promise<ExplanationResult>;
```

---

## Metadata catalog

### `pair_analyses` columns (per-row visibility)

| Column | Values | Meaning |
|---|---|---|
| `explanation_source` | `'ai'` \| `'template'` | Cheap derived flag for filter queries. `'ai'` iff status is `ai_success`. |
| `explanation_status` | `ai_success`, `ai_failed`, `ai_skipped`, `template_only` | Canonical status. `ai_skipped` = no API key. `template_only` = caller opted out (unused today). |
| `explanation_model` | `claude-haiku-4-5-20251001` \| `null` | AI model id when prose came from Claude; `null` otherwise. |
| `explanation_prompt_version` | `v1` (today) | Bump in `explanation-service.ts:PROMPT_VERSION` on every prompt edit. |
| `explanation_generated_at` | ISO timestamp | When the service produced the row (success or fallback). |
| `explanation_error_code` | `missing_api_key`, `timeout`, `network_error`, `http_<status>`, `parse_failed`, `null` | Stable string. `null` only on `ai_success`. |

Indexed by `pair_analyses_explanation_status_idx (explanation_status, created_at desc)`
for fast "show me the last 100 failed explanations" queries.

### `generation_runs` columns (per-run visibility)

| Column | Meaning |
|---|---|
| `ai_calls_attempted` | Total signals routed through `generateExplanation` this run |
| `ai_calls_succeeded` | Subset that returned `status='ai_success'` |
| `ai_calls_failed`    | Subset that returned `status='ai_failed'` (any error code) |
| `ai_calls_skipped`   | Subset that returned `status='ai_skipped'` (no API key) |

These four counters always sum to `ai_calls_attempted` (one of the
three outcome buckets fires per call).

### Useful queries

```sql
-- Per-day explanation health
select date_trunc('day', created_at) as day,
       count(*) filter (where explanation_status = 'ai_success')  as ai_ok,
       count(*) filter (where explanation_status = 'ai_failed')   as ai_failed,
       count(*) filter (where explanation_status = 'ai_skipped')  as ai_skipped
from pair_analyses
group by 1 order by 1 desc;

-- Most common error codes
select explanation_error_code, count(*)
from pair_analyses
where explanation_status = 'ai_failed'
group by 1 order by 2 desc;

-- Runs where the AI pipeline was fully degraded
select id, started_at, ai_calls_attempted, ai_calls_failed
from generation_runs
where function_name = 'generate-signals'
  and ai_calls_attempted > 0
  and ai_calls_succeeded = 0
order by started_at desc;
```

---

## Prompt versioning

`PROMPT_VERSION` is a single constant in
`src/lib/explanation-service.ts` (and its Deno mirror). Today it is
`"v1"` and points to `AI_SYSTEM_PROMPT_V1`. To revise the prompt:

1. Add `AI_SYSTEM_PROMPT_V2 = ...` next to V1.
2. Bump `PROMPT_VERSION` to `"v2"`.
3. Add a `case "v2": return AI_SYSTEM_PROMPT_V2;` arm to `buildSystemPrompt`.
4. Ship.

Every persisted `pair_analyses` row records the version that produced
its prose, so the audit trail is automatic. A future phase can promote
this to a `prompt_versions` table if A/B testing is needed.

---

## Failure modes & error codes

| `errorCode` | Meaning |
|---|---|
| `missing_api_key` | `ANTHROPIC_API_KEY` not set on the function. Status is `ai_skipped`. |
| `http_<status>` | Anthropic returned a non-2xx (e.g. `http_429`, `http_401`). |
| `timeout` | The 10s `AbortController` fired before a response arrived. |
| `network_error` | The `fetch` call threw a non-abort error (DNS, ECONNREFUSED, …). |
| `parse_failed` | Response was 200 but the body was missing the required `BEGINNER` / `EXPERT` / `REASONS_FOR` / `REASONS_AGAINST` sections, or the `content[0]` block was not a text block. |
| `null` | Only on `ai_success`. |

In **every** failure path the service returns the `fallback` arg
verbatim — beginner/expert/reasons/no-trade fields are byte-identical
to the deterministic templates.

---

## Test plan

```bash
# 1. Service unit tests (21 tests)
npx vitest run src/lib/__tests__/explanation-service.test.ts

# 2. Full vitest suite (Phases 6, 7, 8)
npx vitest run

# 3. Type-check
npx tsc --noEmit

# 4. Production build
npx vite build

# 5. End-to-end smoke
supabase functions serve generate-signals
# 5a. Without ANTHROPIC_API_KEY:
unset ANTHROPIC_API_KEY
curl -X POST http://localhost:54321/functions/v1/generate-signals?batch=0
psql -c "select explanation_status, count(*) from pair_analyses
         where created_at > now() - interval '5 minutes' group by 1;"
# Expect only ai_skipped. Then:
psql -c "select ai_calls_attempted, ai_calls_skipped, ai_calls_succeeded
         from generation_runs order by started_at desc limit 1;"
# Expect skipped = attempted, succeeded = 0.

# 5b. With a valid key:
export ANTHROPIC_API_KEY=sk-...
curl -X POST http://localhost:54321/functions/v1/generate-signals?batch=0
# Expect ai_success rows and ai_calls_succeeded > 0.

# 5c. With an invalid key:
export ANTHROPIC_API_KEY=sk-bogus
curl -X POST http://localhost:54321/functions/v1/generate-signals?batch=0
# Expect ai_failed rows with explanation_error_code='http_401'.

# 6. Determinism check (template path)
unset ANTHROPIC_API_KEY
# Run twice and confirm beginner_explanation / reasons_for are
# byte-identical between runs.
```

---

## Files

| File | Action |
|---|---|
| `supabase/migrations/20260413100000_add_explanation_metadata.sql` | NEW — 6 `pair_analyses` columns + 4 `generation_runs` counters + status index |
| `src/lib/explanation-service.ts` | NEW — pure service module (source of truth) |
| `supabase/functions/_shared/explanation-service.ts` | NEW — verbatim Deno mirror (no relative imports) |
| `src/lib/__tests__/explanation-service.test.ts` | NEW — vitest, 21 tests |
| `supabase/functions/generate-signals/index.ts` | MODIFIED — deleted inline AI block (~160 lines), imported the service, walked signals through `generateExplanation`, wired `aiCounters` into `finalizeRun()`, wrote 6 metadata columns to the `pair_analyses` insert, set `created_by_ai` truthfully |
| `supabase/functions/_shared/signal-engine.ts` | MODIFIED — added optional `explanationMeta?: ExplanationResult` slot on `SignalOutput` (typed only, the engine itself does not use it) |
| `src/types/trading.ts` | MODIFIED — additive `explanation*` optional fields on `PairAnalysis` |
| `src/hooks/use-signals.ts` | MODIFIED — `rowToAnalysis()` reads the 6 metadata columns via narrow casts |
| `docs/AI_EXPLANATION_HARDENING.md` | NEW — this document |
| `docs/MOCK_AND_FALLBACK_INVENTORY.md` | MODIFIED — added the explanation-template fallback row |

## Files NOT modified

- `src/components/signals/SignalDetailDrawer.tsx` — UI unchanged this phase
- `src/pages/SignalDetail.tsx`, `src/pages/PairDetail.tsx`, `src/pages/Signals.tsx` — UI unchanged
- `src/integrations/supabase/types.ts` — auto-generated; new columns read via narrow casts
- `supabase/functions/_shared/signal-engine.ts:399-477` — `generateExplanations()` and `generateReasons()` are unchanged (they are the fallback)
- Phase 6 risk engine, Phase 7 alert engine — unrelated

---

## Key design decisions

1. **The service is the only place that knows about Claude.** The runner imports a function and gets back text + metadata. The service owns the entire fallback decision tree, so the runner cannot accidentally write a partial or malformed explanation.
2. **Fallback is passed in, not re-derived.** Determinism is trivial: the service never re-runs the template math.
3. **Metadata lives on `pair_analyses`, counters live on `generation_runs`.** Per-row visibility for the UI, per-run visibility for the operator dashboard. Both populated by the same runner pass.
4. **`signals.created_by_ai` is fixed, not removed.** It now means what its name says: "this signal's prose is from Claude". Existing readers keep working; the meaning becomes accurate.
5. **Prompt versioning is a constant, not a database row.** A `PROMPT_VERSION` constant in the service is the simplest correct thing — the value is persisted on every analysis row, which is the actual audit trail.
6. **Error codes are stable strings, not enums.** Easy to filter and aggregate without a schema change for new error categories.
7. **Dual-location pattern repeats Phases 6 and 7.** `src/lib/explanation-service.ts` for vitest, `supabase/functions/_shared/explanation-service.ts` for Deno. Same TODO about a sync script applies.
8. **No UI changes this phase.** The metadata is exposed via additive `PairAnalysis` fields so a future phase can opt in to render an "AI" / "Template" badge.

---

## TODOs for future phases

- **AI/template badge in `SignalDetailDrawer.tsx`.** All metadata is
  already exposed on `PairAnalysis` via `explanationSource` /
  `explanationStatus`.
- **Persist the raw AI response text** in a sibling table for offline
  review. Today only the parsed prose is persisted.
- **Sync script for the dual-location pattern.** `src/lib/explanation-service.ts`
  ↔ `supabase/functions/_shared/explanation-service.ts` are kept in
  sync by hand. A small `scripts/sync-shared.ts` could codegen the
  `_shared/` copies. Same TODO Phases 6 and 7 already carry.
- **Per-run prompt-version drift detection.** A nightly job could
  alert if a single `generation_runs` row contains rows with mixed
  `explanation_prompt_version` values (would only happen during a
  rolling deploy).
- **A/B prompt testing.** Promote `PROMPT_VERSION` from a constant to
  a `prompt_versions` table with a weighted picker.
