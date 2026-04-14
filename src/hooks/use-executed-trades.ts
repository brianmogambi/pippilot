// Phase 18.3: React Query mutation for inserting executed_trades rows.
//
// Reads will be added in Phase 18.4 (trade history / close flow). For now
// this module only owns the "open a trade" write path. It deliberately
// invalidates every cache that could surface this new trade — journal,
// daily-risk gauge, analytics — so no stale view outlives the mutation.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

/**
 * Full insert payload for executed_trades. Callers MUST pass account_id
 * and account_mode explicitly — we never guess them. When taking a
 * signal-linked trade, the caller is also responsible for copying the
 * planned_* snapshot from the signal at the exact moment the trade is
 * taken (see TakeTradeDialog for the canonical snapshot logic).
 */
export type ExecutedTradeInsert = Omit<
  Database["public"]["Tables"]["executed_trades"]["Insert"],
  "user_id"
>;

export function useCreateExecutedTrade() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ExecutedTradeInsert) => {
      const { data, error } = await supabase
        .from("executed_trades")
        .insert({ ...payload, user_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Trade history, journal and daily-risk all depend on executed
      // trades in Phase 18.4+; invalidate proactively so no consumer
      // has to remember to refetch after a take-trade action.
      queryClient.invalidateQueries({ queryKey: ["executed-trades"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["daily-risk-trades"] });
      toast.success("Trade opened");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to open trade";
      toast.error(msg);
    },
  });
}
