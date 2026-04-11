-- Phase 5: persist risk/reward ratio in signals and pair_analyses.
-- The signal engine already calculates this value (signal-engine.ts:534)
-- but discards it after the verdict check. Persisting removes the
-- need for the frontend to recompute it.

alter table public.signals
  add column if not exists risk_reward numeric;

alter table public.pair_analyses
  add column if not exists risk_reward numeric;

comment on column public.signals.risk_reward is
  'Risk/reward ratio computed by the signal engine: |tp1 - entry| / |entry - sl|';
comment on column public.pair_analyses.risk_reward is
  'Risk/reward ratio (mirror of signals.risk_reward for the linked signal)';
