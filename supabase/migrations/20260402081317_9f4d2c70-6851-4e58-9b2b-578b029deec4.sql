
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  account_size NUMERIC DEFAULT 10000,
  default_risk_pct NUMERIC DEFAULT 1,
  experience_level TEXT DEFAULT 'beginner' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create signals table
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  take_profit_1 NUMERIC NOT NULL,
  take_profit_2 NUMERIC,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  ai_reasoning TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('trade', 'no_trade')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE NOT NULL,
  pair TEXT NOT NULL,
  condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at TIMESTAMPTZ
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create user_watchlist table
CREATE TABLE public.user_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pair TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pair)
);
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles - users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- RLS: signals - readable by all authenticated users (public data)
CREATE POLICY "Authenticated users can view signals" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage signals" ON public.signals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: alerts - users manage their own
CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own alerts" ON public.alerts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS: user_watchlist - users manage their own
CREATE POLICY "Users can view own watchlist" ON public.user_watchlist FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can add to watchlist" ON public.user_watchlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove from watchlist" ON public.user_watchlist FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS: user_roles - viewable by self, manageable by admins
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
