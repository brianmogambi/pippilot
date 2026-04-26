import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTradingAccount } from "@/hooks/use-account";
import { usePipValues } from "@/hooks/use-pip-value";
import { calculateOpenRiskUSD, type OpenPosition } from "@/lib/risk-engine";
import type { AccountMode, JournalEntry } from "@/types/trading";
import type { Freshness } from "@/lib/data-freshness";

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDailyRiskUsed(opts?: {
  /** Override the account-mode scope. Defaults to the user's default account mode. */
  accountMode?: AccountMode;
  /** Override the balance used for the % calculation. Defaults to the default account's balance. */
  balance?: number;
}): {
  riskUsedPct: number;
  riskUsedUsd: number;
  isLoading: boolean;
  pipFreshness: Freshness;
} {
  const { user } = useAuth();
  const { data: account } = useTradingAccount();
  const { getPipValue, freshness: pipFreshness } = usePipValues();
  // Phase 18.2: scope open-trade risk to the default account's mode so
  // demo positions never inflate the real-account daily-risk gauge.
  // Phase 2 (improvement plan): callers can override the mode/balance
  // when previewing risk for a non-default account (e.g., the take-trade
  // dialog where the user can pick any of their accounts).
  const accountMode: AccountMode =
    opts?.accountMode ?? ((account?.account_mode as AccountMode) ?? "demo");
  const balance = opts?.balance ?? Number(account?.balance ?? 0);

  const { data: trades, isLoading } = useQuery({
    queryKey: ["daily-risk-trades", user?.id, accountMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open")
        .eq("account_mode", accountMode)
        .gte("created_at", startOfTodayISO());
      if (error) throw error;
      return (data ?? []) as JournalEntry[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!balance || !trades || trades.length === 0) {
    return { riskUsedPct: 0, riskUsedUsd: 0, isLoading, pipFreshness };
  }

  const positions: OpenPosition[] = trades
    .filter((t) => t.lot_size && t.stop_loss && t.entry_price)
    .map((t) => ({
      pair: t.pair,
      lotSize: Number(t.lot_size),
      entry: Number(t.entry_price),
      stopLoss: Number(t.stop_loss),
      pipValueUSD: getPipValue(t.pair),
    }));

  const riskUsedUsd = calculateOpenRiskUSD(positions);
  const riskUsedPct = (riskUsedUsd / balance) * 100;
  return { riskUsedPct, riskUsedUsd, isLoading, pipFreshness };
}
