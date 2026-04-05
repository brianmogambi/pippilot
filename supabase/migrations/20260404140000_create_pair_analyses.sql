-- Step 3: pair_analyses table for enriched signal analysis data
-- Replaces mockPairAnalysis on the frontend

create table public.pair_analyses (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.signals(id) on delete cascade,
  pair text not null,
  setup_type text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_zone_low numeric not null,
  entry_zone_high numeric not null,
  stop_loss numeric not null,
  tp1 numeric not null,
  tp2 numeric,
  tp3 numeric,
  confidence integer not null check (confidence between 0 and 100),
  setup_quality text not null check (setup_quality in ('A+', 'A', 'B', 'C')),
  invalidation text not null,
  beginner_explanation text not null default '',
  expert_explanation text not null default '',
  reasons_for text[] not null default '{}',
  reasons_against text[] not null default '{}',
  no_trade_reason text,
  verdict text not null check (verdict in ('trade', 'no_trade')),
  created_at timestamptz not null default now()
);

alter table public.pair_analyses enable row level security;

create policy "Anyone can read pair analyses"
  on public.pair_analyses for select to authenticated using (true);

create policy "Service role can manage pair analyses"
  on public.pair_analyses for all to service_role using (true);

create index idx_pair_analyses_pair on public.pair_analyses (pair);
create index idx_pair_analyses_signal_id on public.pair_analyses (signal_id);
create index idx_pair_analyses_created_at on public.pair_analyses (created_at desc);
