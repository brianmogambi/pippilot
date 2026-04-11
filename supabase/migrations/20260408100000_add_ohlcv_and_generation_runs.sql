-- Phase 2: OHLCV candle storage, generation run logging, indicator snapshots
-- Adds persistence for data that Edge Functions previously discarded after analysis.

-- ── Enum for candle timeframes ───────────────────────────────────

create type public.candle_timeframe as enum ('1h', '4h', '1d');

-- ── Generation runs (observability) ──────────────────────────────

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null check (function_name in ('fetch-market-data', 'generate-signals')),
  batch_index integer,
  pairs_processed text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  error_message text,
  candles_fetched integer not null default 0,
  signals_created integer not null default 0,
  api_credits_used integer not null default 0
);

alter table public.generation_runs enable row level security;

create policy "Authenticated users can view generation runs"
  on public.generation_runs for select
  to authenticated using (true);

create policy "Service role can manage generation runs"
  on public.generation_runs for all
  to service_role using (true);

create index idx_generation_runs_started_at
  on public.generation_runs (started_at desc);

create index idx_generation_runs_function_status
  on public.generation_runs (function_name, status);

-- ── OHLCV candles ────────────────────────────────────────────────

create table public.ohlcv_candles (
  symbol text not null,
  timeframe public.candle_timeframe not null,
  candle_time timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric,
  fetched_at timestamptz not null default now(),
  constraint ohlcv_candles_pkey primary key (symbol, timeframe, candle_time)
);

alter table public.ohlcv_candles enable row level security;

create policy "Authenticated users can view candles"
  on public.ohlcv_candles for select
  to authenticated using (true);

create policy "Service role can manage candles"
  on public.ohlcv_candles for all
  to service_role using (true);

-- DESC index for the signal engine access pattern: latest N candles per symbol+timeframe
create index idx_ohlcv_candles_lookup
  on public.ohlcv_candles (symbol, timeframe, candle_time desc);

-- For retention cleanup queries
create index idx_ohlcv_candles_retention
  on public.ohlcv_candles (timeframe, candle_time);

-- ── Indicator snapshots (audit trail) ────────────────────────────

create table public.indicator_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.generation_runs(id) on delete cascade,
  symbol text not null,
  timeframe public.candle_timeframe not null,
  price numeric not null,
  ema20 numeric,
  ema50 numeric,
  ema200 numeric,
  rsi14 numeric,
  atr14 numeric,
  macd_hist numeric,
  bb_upper numeric,
  bb_lower numeric,
  bb_width numeric,
  trend text check (trend in ('bullish', 'bearish', 'neutral')),
  created_at timestamptz not null default now()
);

alter table public.indicator_snapshots enable row level security;

create policy "Authenticated users can view indicator snapshots"
  on public.indicator_snapshots for select
  to authenticated using (true);

create policy "Service role can manage indicator snapshots"
  on public.indicator_snapshots for all
  to service_role using (true);

create index idx_indicator_snapshots_run_id
  on public.indicator_snapshots (run_id);

create index idx_indicator_snapshots_symbol_time
  on public.indicator_snapshots (symbol, created_at desc);

-- ── Retention cleanup function ───────────────────────────────────
-- Call periodically via pg_cron or Edge Function.
-- Retention: 1h = 30 days, 4h = 90 days, 1d = 365 days.

create or replace function public.cleanup_old_candles()
returns table(tf text, deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with d1h as (
    delete from public.ohlcv_candles
    where timeframe = '1h' and candle_time < now() - interval '30 days'
    returning 1
  )
  select '1h'::text, count(*)::bigint from d1h;

  return query
  with d4h as (
    delete from public.ohlcv_candles
    where timeframe = '4h' and candle_time < now() - interval '90 days'
    returning 1
  )
  select '4h'::text, count(*)::bigint from d4h;

  return query
  with d1d as (
    delete from public.ohlcv_candles
    where timeframe = '1d' and candle_time < now() - interval '365 days'
    returning 1
  )
  select '1d'::text, count(*)::bigint from d1d;
end;
$$;
