-- Phase 3: Extend candle_timeframe enum for chart data, update retention, widen constraint.

-- ── Add 5m and 15m to candle_timeframe enum ──────────────────────
alter type public.candle_timeframe add value if not exists '5m';
alter type public.candle_timeframe add value if not exists '15m';

-- ── Allow 'fetch-candles' in generation_runs ─────────────────────
alter table public.generation_runs drop constraint generation_runs_function_name_check;
alter table public.generation_runs add constraint generation_runs_function_name_check
  check (function_name in ('fetch-market-data', 'generate-signals', 'fetch-candles'));

-- ── Replace retention function with 5m/15m support ───────────────
-- Retention: 5m=7d, 15m=14d, 1h=30d, 4h=90d, 1d=365d
create or replace function public.cleanup_old_candles()
returns table(tf text, deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with d5m as (
    delete from public.ohlcv_candles
    where timeframe = '5m' and candle_time < now() - interval '7 days'
    returning 1
  )
  select '5m'::text, count(*)::bigint from d5m;

  return query
  with d15m as (
    delete from public.ohlcv_candles
    where timeframe = '15m' and candle_time < now() - interval '14 days'
    returning 1
  )
  select '15m'::text, count(*)::bigint from d15m;

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
