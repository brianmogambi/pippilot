import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { SIGNAL_STALE_THRESHOLD_MS, STALE_THRESHOLD_MS } from "@/lib/data-freshness";

/**
 * Fires edge functions once per session when data is stale.
 *
 * - fetch-market-data: triggers if newest market_data_cache row is
 *   older than STALE_THRESHOLD_MS (10 min).
 * - generate-signals batch 0: triggers if newest signal is older
 *   than SIGNAL_STALE_THRESHOLD_MS (4 hours). Only kicks batch 0
 *   (2 major pairs) so the user sees something fast; the cron job
 *   handles the remaining batches.
 *
 * All calls are fire-and-forget. Errors are logged, never thrown.
 */
export function useAutoRefresh() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const triggered = useRef(false);

  useEffect(() => {
    if (!user || triggered.current) return;
    triggered.current = true;

    (async () => {
      try {
        // Check market data freshness
        const { data: newestMarket } = await supabase
          .from("market_data_cache")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const marketAge = newestMarket?.updated_at
          ? Date.now() - new Date(newestMarket.updated_at).getTime()
          : Infinity;

        if (marketAge > STALE_THRESHOLD_MS) {
          console.log("[auto-refresh] Market data stale, triggering fetch-market-data");
          supabase.functions
            .invoke("fetch-market-data")
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["market-data-all"] });
            })
            .catch((e) => console.warn("[auto-refresh] fetch-market-data failed:", e));
        }

        // Check signal freshness
        const { data: newestSignal } = await supabase
          .from("signals")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const signalAge = newestSignal?.created_at
          ? Date.now() - new Date(newestSignal.created_at).getTime()
          : Infinity;

        if (signalAge > SIGNAL_STALE_THRESHOLD_MS) {
          console.log("[auto-refresh] Signals stale, triggering generate-signals batch 0");
          supabase.functions
            .invoke("generate-signals", { body: {}, headers: {} })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["signals"] });
              queryClient.invalidateQueries({ queryKey: ["signals-active"] });
              queryClient.invalidateQueries({ queryKey: ["pair-analyses"] });
            })
            .catch((e) => console.warn("[auto-refresh] generate-signals failed:", e));
        }
      } catch (e) {
        console.warn("[auto-refresh] check failed:", e);
      }
    })();
  }, [user, queryClient]);
}
