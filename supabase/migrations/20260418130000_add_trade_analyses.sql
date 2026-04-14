-- Phase 18.5: Rule-based post-trade analysis
--
-- Persists the output of the deterministic comparison engine that
-- lives in src/lib/trade-analysis/. One row per executed_trades row
-- (unique constraint on executed_trade_id) — the close flow inserts
-- a row at close time, and any later re-compute upserts onto the
-- same row so there is always exactly one current analysis per
-- executed trade.

create table public.trade_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  executed_trade_id uuid not null unique
    references public.executed_trades(id) on delete cascade,

  -- Flag codes raised by the rule engine (e.g. 'late_entry',
  -- 'tighter_stop_than_plan', 'reduced_rr', 'signal_invalidated').
  flags text[] not null default '{}',

  -- Per-flag context: numeric deltas, thresholds, optional human
  -- hints. Shape: { [flag_code]: { ...details } }. Stored as jsonb
  -- so Phase 18.6 (NL review) can consume it without another query.
  details jsonb not null default '{}'::jsonb,

  -- 0–100 scores. Nullable because manual trades have no signal to
  -- score against, and still-open trades have no execution outcome.
  signal_quality_score integer check (signal_quality_score between 0 and 100),
  execution_quality_score integer check (execution_quality_score between 0 and 100),
  discipline_score integer check (discipline_score between 0 and 100),
  risk_management_score integer check (risk_management_score between 0 and 100),

  -- Canonical classification of why this trade resolved the way it did.
  primary_outcome_reason text check (
    primary_outcome_reason in (
      'won_per_plan',
      'won_despite_execution_drift',
      'lost_per_plan',
      'lost_to_execution_drift',
      'signal_invalidated',
      'breakeven',
      'manual_no_signal',
      'trade_not_yet_closed',
      'cancelled'
    )
  ),

  -- Human-readable next-action phrases. Rendered as a bullet list
  -- in the post-trade review UI (Phase 18.5) and used as input
  -- context for the NL summarizer (Phase 18.6).
  improvement_actions text[] not null default '{}',

  -- Version of the rule set that produced this row. Bumped when
  -- rules change, so we can see stale analyses at a glance.
  rule_version text not null default 'v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trade_analyses enable row level security;

create index idx_trade_analyses_user
  on public.trade_analyses (user_id, created_at desc);

create index idx_trade_analyses_trade
  on public.trade_analyses (executed_trade_id);

create index idx_trade_analyses_outcome
  on public.trade_analyses (user_id, primary_outcome_reason);

create policy "Users can view own trade analyses"
  on public.trade_analyses for select
  to authenticated using (auth.uid() = user_id);

create policy "Users can insert own trade analyses"
  on public.trade_analyses for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users can update own trade analyses"
  on public.trade_analyses for update
  to authenticated using (auth.uid() = user_id);

create policy "Users can delete own trade analyses"
  on public.trade_analyses for delete
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages trade analyses"
  on public.trade_analyses for all
  to service_role using (true);

comment on table public.trade_analyses is
  'Rule-engine output comparing executed_trades.planned_* against actual execution. One row per executed trade; upserted on close and on any re-compute. Phase 18.5.';
