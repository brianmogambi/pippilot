-- Add foreign key constraints to tables missing them
-- Tables: trading_accounts, user_risk_profiles, trade_journal_entries

ALTER TABLE public.trading_accounts
  ADD CONSTRAINT trading_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_risk_profiles
  ADD CONSTRAINT user_risk_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.trade_journal_entries
  ADD CONSTRAINT trade_journal_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Only one default trading account per user
CREATE UNIQUE INDEX trading_accounts_one_default_per_user
  ON public.trading_accounts (user_id)
  WHERE is_default = true;

-- Performance indexes for common query patterns
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts (user_id);
CREATE INDEX idx_trade_journal_entries_user_id ON public.trade_journal_entries (user_id);
CREATE INDEX idx_trade_journal_entries_pair ON public.trade_journal_entries (pair);
CREATE INDEX idx_signals_status ON public.signals (status);
CREATE INDEX idx_signals_pair ON public.signals (pair);
CREATE INDEX idx_alerts_user_id ON public.alerts (user_id);
CREATE INDEX idx_alerts_is_read ON public.alerts (user_id, is_read);
CREATE INDEX idx_user_watchlist_user_id ON public.user_watchlist (user_id);
