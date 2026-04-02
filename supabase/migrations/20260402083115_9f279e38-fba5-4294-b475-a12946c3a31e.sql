
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS account_equity numeric DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS max_daily_loss_pct numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS preferred_pairs text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_sessions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trading_style text DEFAULT 'intraday',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
