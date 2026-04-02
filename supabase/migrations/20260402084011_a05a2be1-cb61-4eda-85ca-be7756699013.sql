
-- 1. New table: trading_accounts
CREATE TABLE public.trading_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_name text NOT NULL DEFAULT 'Primary',
  account_currency text NOT NULL DEFAULT 'USD',
  balance numeric NOT NULL DEFAULT 10000,
  equity numeric NOT NULL DEFAULT 10000,
  leverage numeric,
  broker_name text,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. New table: user_risk_profiles
CREATE TABLE public.user_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  risk_per_trade_pct numeric NOT NULL DEFAULT 1,
  max_daily_loss_pct numeric NOT NULL DEFAULT 5,
  max_total_open_risk_pct numeric NOT NULL DEFAULT 10,
  conservative_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_risk_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own risk profile" ON public.user_risk_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own risk profile" ON public.user_risk_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own risk profile" ON public.user_risk_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 3. New table: instruments
CREATE TABLE public.instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  instrument_type text NOT NULL DEFAULT 'forex',
  pip_value numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view instruments" ON public.instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert instruments" ON public.instruments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update instruments" ON public.instruments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. New table: trade_journal_entries
CREATE TABLE public.trade_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pair text NOT NULL,
  direction text NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  result_pips numeric,
  result_amount numeric,
  lot_size numeric,
  notes text,
  followed_plan boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own journal" ON public.trade_journal_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own journal" ON public.trade_journal_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own journal" ON public.trade_journal_entries FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own journal" ON public.trade_journal_entries FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Expand signals table
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS take_profit_3 numeric;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS setup_type text;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS invalidation_reason text;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS created_by_ai boolean NOT NULL DEFAULT true;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 6. Expand alerts table
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'price';
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

-- 7. Seed instruments
INSERT INTO public.instruments (symbol, base_currency, quote_currency, pip_value) VALUES
  ('EUR/USD', 'EUR', 'USD', 0.0001),
  ('GBP/USD', 'GBP', 'USD', 0.0001),
  ('USD/JPY', 'USD', 'JPY', 0.01),
  ('AUD/USD', 'AUD', 'USD', 0.0001),
  ('USD/CAD', 'USD', 'CAD', 0.0001),
  ('NZD/USD', 'NZD', 'USD', 0.0001),
  ('EUR/GBP', 'EUR', 'GBP', 0.0001),
  ('GBP/JPY', 'GBP', 'JPY', 0.01),
  ('EUR/JPY', 'EUR', 'JPY', 0.01),
  ('AUD/JPY', 'AUD', 'JPY', 0.01),
  ('CHF/JPY', 'CHF', 'JPY', 0.01),
  ('EUR/AUD', 'EUR', 'AUD', 0.0001),
  ('GBP/AUD', 'GBP', 'AUD', 0.0001),
  ('EUR/CAD', 'EUR', 'CAD', 0.0001),
  ('USD/CHF', 'USD', 'CHF', 0.0001);

-- 8. Update handle_new_user to also create trading_accounts and user_risk_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.trading_accounts (user_id, account_currency, balance, equity)
  VALUES (NEW.id, 'USD', 10000, 10000);

  INSERT INTO public.user_risk_profiles (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;
