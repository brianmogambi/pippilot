-- Phase 8: explanation layer hardening.
-- Adds metadata so every persisted explanation is annotated with
-- source / status / model / prompt_version / generated_at / error_code,
-- and adds aggregate AI-call counters on the generation_runs row so
-- operators can spot a degraded explanation pipeline at a glance.

alter table public.pair_analyses
  add column if not exists explanation_source text
    check (explanation_source in ('ai', 'template')),
  add column if not exists explanation_status text
    check (explanation_status in ('ai_success', 'ai_failed', 'ai_skipped', 'template_only')),
  add column if not exists explanation_model text,
  add column if not exists explanation_prompt_version text,
  add column if not exists explanation_generated_at timestamptz,
  add column if not exists explanation_error_code text;

create index if not exists pair_analyses_explanation_status_idx
  on public.pair_analyses (explanation_status, created_at desc);

alter table public.generation_runs
  add column if not exists ai_calls_attempted integer not null default 0,
  add column if not exists ai_calls_succeeded integer not null default 0,
  add column if not exists ai_calls_failed integer not null default 0,
  add column if not exists ai_calls_skipped integer not null default 0;
