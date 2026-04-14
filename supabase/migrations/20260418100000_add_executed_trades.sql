-- Phase 1: Signal → Trade → Journal → AI Review — data model foundation
--
-- Adds:
--   1. trading_accounts.account_mode  (source of truth for demo vs real)
--   2. executed_trades                 (dedicated execution record + signal snapshot)
--   3. trade_journal_entries.executed_trade_id  (link journal to execution)
--
-- No UI, hooks, or business logic change in this phase. All new columns
-- on existing tables are nullable or defaulted so legacy rows keep working.

-- ── 1. trading_accounts.account_mode ────────────────────────────────

alter table public.trading_accounts
  add column account_mode text not null default 'demo'
  check (account_mode in ('demo', 'real'));

create index idx_trading_accounts_user_mode
  on public.trading_accounts (user_id, account_mode);

comment on column public.trading_accounts.account_mode is
  'Demo vs real classification. Source of truth for demo/real separation throughout the app. Existing rows default to ''demo''.';

-- ── 2. executed_trades ──────────────────────────────────────────────

create table public.executed_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  account_mode text not null check (account_mode in ('demo', 'real')),
  signal_id uuid references public.signals(id) on delete set null,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),

  -- Planned snapshot (copied from the signal at the moment the trade was taken)
  planned_entry_low numeric,
  planned_entry_high numeric,
  planned_stop_loss numeric,
  planned_take_profit_1 numeric,
  planned_take_profit_2 numeric,
  planned_confidence integer,
  planned_setup_type text,
  planned_timeframe text,
  planned_reasoning_snapshot text,

  -- Actual execution
  actual_entry_price numeric not null,
  actual_stop_loss numeric,
  actual_take_profit numeric,
  actual_exit_price numeric,
  lot_size numeric,
  position_size numeric,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  result_status text not null default 'open'
    check (result_status in ('open', 'win', 'loss', 'breakeven', 'cancelled')),
  pnl numeric,
  pnl_percent numeric,
  broker_position_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.executed_trades enable row level security;

create index idx_executed_trades_user_opened
  on public.executed_trades (user_id, opened_at desc);

create index idx_executed_trades_account
  on public.executed_trades (account_id);

create index idx_executed_trades_signal
  on public.executed_trades (signal_id)
  where signal_id is not null;

create index idx_executed_trades_user_mode_status
  on public.executed_trades (user_id, account_mode, result_status);

create policy "Users can view own executed trades"
  on public.executed_trades for select
  to authenticated using (auth.uid() = user_id);

create policy "Users can insert own executed trades"
  on public.executed_trades for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users can update own executed trades"
  on public.executed_trades for update
  to authenticated using (auth.uid() = user_id);

create policy "Users can delete own executed trades"
  on public.executed_trades for delete
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages executed trades"
  on public.executed_trades for all
  to service_role using (true);

comment on table public.executed_trades is
  'User-initiated trade execution records. Each row stores the actual execution details plus a snapshot of the originating signal as it existed at take-trade time (planned_* columns). signal_id is nullable to allow manual trades. account_mode is denormalized from trading_accounts.account_mode at insert time so history survives later account reclassification.';

-- ── 3. trade_journal_entries.executed_trade_id ──────────────────────

alter table public.trade_journal_entries
  add column executed_trade_id uuid
  references public.executed_trades(id) on delete set null;

create index idx_journal_executed_trade
  on public.trade_journal_entries (executed_trade_id)
  where executed_trade_id is not null;

comment on column public.trade_journal_entries.executed_trade_id is
  'Optional link to an executed_trades row. Pre-Phase-1 journal rows and manual journal-only entries have null here.';
