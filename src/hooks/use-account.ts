import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TradingAccount, UserRiskProfile } from "@/types/trading";

export function useTradingAccount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trading-account", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      return data as TradingAccount | null;
    },
    enabled: !!user,
  });
}

export function useRiskProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["risk-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_risk_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as UserRiskProfile | null;
    },
    enabled: !!user,
  });
}
