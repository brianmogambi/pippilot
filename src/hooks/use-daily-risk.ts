import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTradingAccount } from "@/hooks/use-account";
import { usePipValues } from "@/hooks/use-pip-value";
import { pipMultiplier } from "@/lib/pip-value";
import type { JournalEntry } from "@/types/trading";

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDailyRiskUsed(): { riskUsedPct: number; isLoading: boolean } {
  const { user } = useAuth();
  const { data: account } = useTradingAccount();
  const { getPipValue } = usePipValues();

  const { data: trades, isLoading } = useQuery({
    queryKey: ["daily-risk-trades", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open")
        .gte("created_at", startOfTodayISO());
      if (error) throw error;
      return (data ?? []) as JournalEntry[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!account?.balance || !trades || trades.length === 0) {
    return { riskUsedPct: 0, isLoading };
  }

  const totalRiskUsd = trades.reduce((sum, trade) => {
    if (!trade.lot_size || !trade.stop_loss || !trade.entry_price) return sum;
    const pipDist = Math.abs(trade.entry_price - trade.stop_loss) * pipMultiplier(trade.pair);
    const pipVal = getPipValue(trade.pair);
    return sum + trade.lot_size * pipDist * pipVal;
  }, 0);

  const riskUsedPct = (totalRiskUsd / Number(account.balance)) * 100;
  return { riskUsedPct, isLoading };
}
