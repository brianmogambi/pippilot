-- Phase 7: alert engine v2
-- Adds the typed event_kind column, dedupe_key, analysis_run_id, and a
-- unique partial index that makes the runner idempotent.

alter table public.alerts
  add column if not exists event_kind text check (event_kind in (
    'setup_forming',
    'entry_reached',
    'confirmation_reached',
    'tp1_reached',
    'tp2_reached',
    'tp3_reached',
    'invalidation',
    'risk_breach'
  )),
  add column if not exists dedupe_key text,
  add column if not exists analysis_run_id uuid references public.generation_runs(id) on delete set null;

create unique index if not exists alerts_unique_pending_event
  on public.alerts (user_id, signal_id, event_kind)
  where status = 'pending';

create index if not exists alerts_dedupe_key_idx
  on public.alerts (dedupe_key);

create index if not exists alerts_event_kind_idx
  on public.alerts (event_kind, created_at desc);

-- Extend generation_runs.function_name to include the new runner
alter table public.generation_runs
  drop constraint if exists generation_runs_function_name_check;

alter table public.generation_runs
  add constraint generation_runs_function_name_check
  check (function_name in ('fetch-market-data', 'generate-signals', 'evaluate-alerts'));
