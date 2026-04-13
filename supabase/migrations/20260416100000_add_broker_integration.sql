-- Phase 14: Read-only broker integration
-- 6 tables for syncing account/position state from external trading platforms.
-- No execution — read-only observation only.

-- ── broker_connections ─────────────────────────────────────────────

create table public.broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_type text not null check (broker_type in ('mt5', 'ctrader', 'custom')),
  label text not null default 'Default',
  encrypted_credentials jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'error', 'revoked')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.broker_connections enable row level security;

create unique index idx_broker_connections_user_type_label
  on public.broker_connections (user_id, broker_type, label);

create index idx_broker_connections_status
  on public.broker_connections (status);

-- Users can read their own connections but NOT the encrypted_credentials column.
-- We enforce this at the application layer (frontend selects safe columns only).
-- RLS ensures row-level ownership.
create policy "Users can view own broker connections"
  on public.broker_connections for select
  to authenticated using (auth.uid() = user_id);

create policy "Users can insert own broker connections"
  on public.broker_connections for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users can update own broker connections"
  on public.broker_connections for update
  to authenticated using (auth.uid() = user_id);

create policy "Users can delete own broker connections"
  on public.broker_connections for delete
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages broker connections"
  on public.broker_connections for all
  to service_role using (true);

-- ── synced_accounts ────────────────────────────────────────────────

create table public.synced_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.broker_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_account_id text not null,
  account_name text,
  currency text not null default 'USD',
  balance numeric not null default 0,
  equity numeric not null default 0,
  margin_used numeric not null default 0,
  free_margin numeric not null default 0,
  leverage numeric,
  server_name text,
  is_live boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.synced_accounts enable row level security;

create unique index idx_synced_accounts_connection_broker_id
  on public.synced_accounts (connection_id, broker_account_id);

create index idx_synced_accounts_user
  on public.synced_accounts (user_id);

create policy "Users can view own synced accounts"
  on public.synced_accounts for select
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages synced accounts"
  on public.synced_accounts for all
  to service_role using (true);

-- ── open_positions ─────────────────────────────────────────────────

create table public.open_positions (
  id uuid primary key default gen_random_uuid(),
  synced_account_id uuid not null references public.synced_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_ticket_id text not null,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  volume numeric not null,
  open_price numeric not null,
  current_price numeric,
  stop_loss numeric,
  take_profit numeric,
  swap numeric not null default 0,
  commission numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  opened_at timestamptz not null,
  synced_at timestamptz not null default now()
);

alter table public.open_positions enable row level security;

create unique index idx_open_positions_account_ticket
  on public.open_positions (synced_account_id, broker_ticket_id);

create index idx_open_positions_user
  on public.open_positions (user_id);

create index idx_open_positions_symbol
  on public.open_positions (symbol);

create policy "Users can view own open positions"
  on public.open_positions for select
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages open positions"
  on public.open_positions for all
  to service_role using (true);

-- ── pending_orders ─────────────────────────────────────────────────

create table public.pending_orders (
  id uuid primary key default gen_random_uuid(),
  synced_account_id uuid not null references public.synced_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_ticket_id text not null,
  symbol text not null,
  order_type text not null
    check (order_type in (
      'buy_limit', 'sell_limit',
      'buy_stop', 'sell_stop',
      'buy_stop_limit', 'sell_stop_limit'
    )),
  volume numeric not null,
  price numeric not null,
  stop_loss numeric,
  take_profit numeric,
  expiration timestamptz,
  placed_at timestamptz not null,
  synced_at timestamptz not null default now()
);

alter table public.pending_orders enable row level security;

create unique index idx_pending_orders_account_ticket
  on public.pending_orders (synced_account_id, broker_ticket_id);

create index idx_pending_orders_user
  on public.pending_orders (user_id);

create policy "Users can view own pending orders"
  on public.pending_orders for select
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages pending orders"
  on public.pending_orders for all
  to service_role using (true);

-- ── account_snapshots ──────────────────────────────────────────────

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  synced_account_id uuid not null references public.synced_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  balance numeric not null,
  equity numeric not null,
  margin_used numeric not null default 0,
  open_positions_count integer not null default 0,
  unrealized_pnl numeric not null default 0,
  snapshot_at timestamptz not null default now()
);

alter table public.account_snapshots enable row level security;

create index idx_account_snapshots_account_time
  on public.account_snapshots (synced_account_id, snapshot_at desc);

create index idx_account_snapshots_user
  on public.account_snapshots (user_id);

create policy "Users can view own account snapshots"
  on public.account_snapshots for select
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages account snapshots"
  on public.account_snapshots for all
  to service_role using (true);

-- ── sync_logs ──────────────────────────────────────────────────────

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.broker_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_type text not null
    check (sync_type in ('account', 'positions', 'orders', 'history', 'full')),
  status text not null
    check (status in ('started', 'success', 'partial', 'failed')),
  items_synced integer not null default 0,
  duration_ms integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.sync_logs enable row level security;

create index idx_sync_logs_connection_started
  on public.sync_logs (connection_id, started_at desc);

create index idx_sync_logs_user
  on public.sync_logs (user_id);

create policy "Users can view own sync logs"
  on public.sync_logs for select
  to authenticated using (auth.uid() = user_id);

create policy "Service role manages sync logs"
  on public.sync_logs for all
  to service_role using (true);
