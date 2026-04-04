ALTER TABLE public.profiles
  ADD COLUMN default_timeframe text DEFAULT 'H1',
  ADD COLUMN preferred_strategies text[] DEFAULT '{}',
  ADD COLUMN alert_channels text[] DEFAULT '{"in_app"}';