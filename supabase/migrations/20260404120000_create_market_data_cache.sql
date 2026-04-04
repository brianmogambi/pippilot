-- Step 1: Create market_data_cache table for live market data
-- Replaces mock data in src/data/mockMarketData.ts

create table public.market_data_cache (
  symbol text primary key,
  price numeric not null default 0,
  spread numeric not null default 0,
  daily_change numeric not null default 0,
  daily_change_pct numeric not null default 0,
  atr numeric not null default 0,
  volatility text not null default 'Low',
  trend_h1 text not null default 'neutral',
  trend_h4 text not null default 'neutral',
  trend_d1 text not null default 'neutral',
  active_session text not null default 'Closed',
  news_risk boolean not null default false,
  support_level numeric not null default 0,
  resistance_level numeric not null default 0,
  session_high numeric not null default 0,
  session_low numeric not null default 0,
  prev_day_high numeric not null default 0,
  prev_day_low numeric not null default 0,
  market_structure text not null default 'ranging',
  updated_at timestamptz not null default now()
);

alter table public.market_data_cache enable row level security;

-- Authenticated users can read market data
create policy "Authenticated users can read market data"
  on public.market_data_cache for select
  to authenticated using (true);

-- Service role (Edge Functions) can manage market data
create policy "Service role can manage market data"
  on public.market_data_cache for all
  to service_role using (true);

-- Admins can also manage market data (manual corrections)
create policy "Admins can manage market data"
  on public.market_data_cache for all
  to authenticated using (public.has_role(auth.uid(), 'admin'));
