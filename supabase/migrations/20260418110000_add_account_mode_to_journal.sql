-- Phase 18.2: Demo vs real separation across the app
--
-- Phase 18.1 added account_mode to trading_accounts and executed_trades.
-- This migration denormalizes account_mode onto trade_journal_entries
-- so that journal queries, filters, and dashboard stats can split
-- demo and real performance without joining executed_trades (which
-- legacy rows do not have).
--
-- Existing rows default to 'demo' — the safest bucket that cannot
-- mislabel a real-money trade as a practice trade. Users who have
-- flipped their default account to 'real' in the new settings UI can
-- re-tag historical journal entries manually later.

alter table public.trade_journal_entries
  add column account_mode text not null default 'demo'
  check (account_mode in ('demo', 'real'));

create index idx_journal_user_mode
  on public.trade_journal_entries (user_id, account_mode);

comment on column public.trade_journal_entries.account_mode is
  'Demo vs real classification. Denormalized from the user''s trading account at write time. Legacy rows default to ''demo''.';
