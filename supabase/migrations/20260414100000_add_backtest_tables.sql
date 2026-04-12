-- Phase 10: Backtesting + replay foundation
-- Tables for historical replay of the deterministic signal engine.

-- ── backtest_runs ──────────────────────────────────────────────────

create table public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  label text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'partial', 'failed')),
  config jsonb not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  signal_engine_version text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.backtest_runs enable row level security;

create policy "Authenticated users can view backtest runs"
  on public.backtest_runs for select
  to authenticated using (true);

create policy "Service role can manage backtest runs"
  on public.backtest_runs for all
  to service_role using (true);

create index idx_backtest_runs_status_started
  on public.backtest_runs (status, started_at desc);

-- ── backtest_signals ───────────────────────────────────────────────

create table public.backtest_signals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.backtest_runs(id) on delete cascade,
  pair text not null,
  timeframe text not null,
  direction text not null check (direction in ('long', 'short')),
  setup_type text not null,
  setup_quality text,
  verdict text,
  confidence numeric,
  entry_price numeric not null,
  stop_loss numeric not null,
  take_profit_1 numeric not null,
  take_profit_2 numeric,
  take_profit_3 numeric,
  risk_reward numeric,
  cursor_time timestamptz not null,
  reasons_for text[] not null default '{}',
  reasons_against text[] not null default '{}',
  invalidation text,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

alter table public.backtest_signals enable row level security;

create policy "Authenticated users can view backtest signals"
  on public.backtest_signals for select
  to authenticated using (true);

create policy "Service role can manage backtest signals"
  on public.backtest_signals for all
  to service_role using (true);

create index idx_backtest_signals_run_cursor
  on public.backtest_signals (run_id, cursor_time);

create index idx_backtest_signals_run_pair
  on public.backtest_signals (run_id, pair);

-- ── signal_outcomes ────────────────────────────────────────────────
-- Generic outcome table — references either a backtest signal or a live signal.
-- Used by Phase 10 for backtests; Phase 11 will populate live_signal_id rows.

create table public.signal_outcomes (
  id uuid primary key default gen_random_uuid(),
  backtest_signal_id uuid references public.backtest_signals(id) on delete cascade,
  live_signal_id uuid references public.signals(id) on delete cascade,
  outcome text not null
    check (outcome in (
      'entry_hit', 'tp1_hit', 'tp2_hit', 'tp3_hit',
      'sl_hit', 'invalidated', 'expired', 'no_entry'
    )),
  entry_hit_at timestamptz,
  resolved_at timestamptz not null,
  bars_to_resolution integer not null default 0,
  exit_price numeric,
  r_multiple numeric,
  pips_result numeric,
  resolution_path jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint signal_outcomes_one_owner check (
    (backtest_signal_id is not null and live_signal_id is null)
    or (backtest_signal_id is null and live_signal_id is not null)
  )
);

alter table public.signal_outcomes enable row level security;

create policy "Authenticated users can view signal outcomes"
  on public.signal_outcomes for select
  to authenticated using (true);

create policy "Service role can manage signal outcomes"
  on public.signal_outcomes for all
  to service_role using (true);

create index idx_signal_outcomes_backtest
  on public.signal_outcomes (backtest_signal_id);

create index idx_signal_outcomes_live
  on public.signal_outcomes (live_signal_id);

-- ── backtest_results ───────────────────────────────────────────────

create table public.backtest_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.backtest_runs(id) on delete cascade,
  total_signals integer not null default 0,
  total_trades integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  win_rate numeric,
  avg_r numeric,
  expectancy_r numeric,
  max_drawdown_r numeric,
  profit_factor numeric,
  breakdown_by_pair jsonb not null default '{}'::jsonb,
  breakdown_by_setup jsonb not null default '{}'::jsonb,
  breakdown_by_timeframe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.backtest_results enable row level security;

create policy "Authenticated users can view backtest results"
  on public.backtest_results for select
  to authenticated using (true);

create policy "Service role can manage backtest results"
  on public.backtest_results for all
  to service_role using (true);

create index idx_backtest_results_run
  on public.backtest_results (run_id);
