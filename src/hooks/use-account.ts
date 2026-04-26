import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  AccountMode,
  TradingAccount,
  UserRiskProfile,
} from "@/types/trading";

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

/**
 * Phase 18.2: return every trading account the user owns so the
 * settings page can expose a per-account mode toggle. Ordered with
 * the default account first, then by creation time.
 */
export function useTradingAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trading-accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TradingAccount[];
    },
    enabled: !!user,
  });
}

/**
 * Phase 18.2: resolved default account mode. Callers that need to
 * scope journal/stats queries to the "current" mode should use this
 * rather than reading the trading_accounts row directly, so the
 * fallback behaviour (legacy rows without an account default to
 * 'demo') is consistent everywhere.
 */
export function useDefaultAccountMode(): AccountMode {
  const { data: account } = useTradingAccount();
  return (account?.account_mode as AccountMode) ?? "demo";
}

/**
 * Phase 18.2: patch any field on a trading_accounts row. Currently
 * only used for `account_mode`, but the generic payload keeps future
 * account fields (broker, name, balance) from needing a second hook.
 */
export function useUpdateTradingAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<
        Pick<
          TradingAccount,
          "account_mode" | "account_name" | "broker_name" | "balance" | "equity" | "is_default"
        >
      >;
    }) => {
      const { error } = await supabase
        .from("trading_accounts")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate everything that depends on account identity or mode.
      queryClient.invalidateQueries({ queryKey: ["trading-account"] });
      queryClient.invalidateQueries({ queryKey: ["trading-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      queryClient.invalidateQueries({ queryKey: ["daily-risk-trades"] });
      toast.success("Account updated");
    },
    onError: () => toast.error("Failed to update account"),
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
